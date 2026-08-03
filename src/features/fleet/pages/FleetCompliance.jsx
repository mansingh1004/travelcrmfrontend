// src/features/fleet/pages/FleetCompliance.jsx
//
// The papers a check-post, an RTO or a border post asks for.
//
// This replaces four date columns on the vehicle and one on the driver. That shape could hold one
// expiry per document and nothing else — no number, no authority, no jurisdiction, and no history:
// renewing overwrote the date, and the certificate that was valid last March became
// unreconstructable. It also had nowhere to put the papers an operator is actually stopped for.
//
// WHAT THIS SCREEN IS FOR, IN ORDER:
//   1. What lapses next — sorted soonest-first, because that is the only question with a deadline.
//   2. The 35 backfilled rows that still need a human. They arrived knowing ONLY an expiry date;
//      the number, issue date and authority were genuinely unknown and were deliberately not
//      invented. "Needs review" is the filter that finds them.
//   3. Recording a renewal, which inserts a NEW row and supersedes the old one — never an edit.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, Plus, Search, RotateCcw, AlertTriangle, Check, FileWarning,
  History, Ban, PencilLine, CalendarClock, Globe2,
  Paperclip,
} from "lucide-react";

import fleetService from "../api/fleetService";
import { hasPermission, P } from "@shared/lib/access";
import CommonPagination from "../components/CommanPegination";
import {
  Button, Badge, PageShell, PageHeader, LoadingState, EmptyState, ConfirmDialog,
  StatCard, StatCardRow, Panel, EntityCard, CodeChip, MiniStat,
  useToast, errMsg, fmtDate, todayDateInput,
} from "../components/fleetUi";
import { Field, fieldCls } from "../components/fleetFormKit";
import AttachmentsDialog from "../components/AttachmentsDialog";

/** Status tone. EXPIRED and REVOKED are the two that actually stop a vehicle. */
const STATUS_TONE = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  EXPIRING: "bg-amber-100 text-amber-700 border border-amber-200",
  EXPIRED: "bg-rose-100 text-rose-700 border border-rose-200",
  SUPERSEDED: "bg-slate-100 text-slate-500 border border-slate-200",
  REVOKED: "bg-rose-100 text-rose-700 border border-rose-200",
};
const cardTone = (d) =>
  d.status === "EXPIRED" || d.status === "REVOKED" ? "rose"
    : d.status === "EXPIRING" ? "amber"
    : d.status === "SUPERSEDED" ? "slate" : "green";

const blankDoc = (sticky = {}) => ({
  ownerType: sticky.ownerType || "VEHICLE",
  vehiclePublicId: sticky.vehiclePublicId || "",
  driverPublicId: sticky.driverPublicId || "",
  category: "",
  documentNumber: "",
  issuingAuthority: sticky.issuingAuthority || "",
  stateCode: sticky.stateCode || "",
  borderPost: "",
  issuedOn: "",
  validFrom: "",
  validUntil: "",
  exitDeadline: "",
  notes: "",
});

export default function FleetCompliance() {
  const { showToast } = useToast();
  const numberRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState(blankDoc());
  const [errors, setErrors] = useState({});

  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [renewTarget, setRenewTarget] = useState(null);
  const [renewForm, setRenewForm] = useState({ validUntil: "", documentNumber: "", issuedOn: "" });
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [attachTarget, setAttachTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");

  const canCreate = hasPermission(P.FLEET_CREATE);
  const canUpdate = hasPermission(P.FLEET_UPDATE);

  /* ── reference data ─────────────────────────────────────────────────── */
  useEffect(() => {
    fleetService.listDocumentCategories()
      .then(setCategories)
      .catch((e) => showToast(errMsg(e, "Failed to load document categories."), "error"));
    fleetService.vehicleOptions().then(setVehicles).catch(() => {});
    fleetService.driverOptions().then(setDrivers).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    return fleetService
      .listDocuments({
        status: statusF, category: categoryF,
        needsReview: needsReviewOnly || undefined,
        search: debounced, page, size,
      })
      .then((res) => { setItems(res.items); setPagination(res.pagination); })
      .catch((e) => showToast(errMsg(e, "Failed to load documents."), "error"))
      .finally(() => setLoading(false));
  }, [statusF, categoryF, needsReviewOnly, debounced, page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── derived ────────────────────────────────────────────────────────── */
  const catsForOwner = useMemo(
    () => categories.filter((c) => c.owner === draft.ownerType || c.owner === "EITHER"),
    [categories, draft.ownerType],
  );
  const selectedCat = useMemo(
    () => categories.find((c) => c.code === draft.category),
    [categories, draft.category],
  );

  const expiredCount = useMemo(() => items.filter((d) => d.status === "EXPIRED").length, [items]);
  const expiringCount = useMemo(() => items.filter((d) => d.status === "EXPIRING").length, [items]);
  const reviewCount = useMemo(() => items.filter((d) => d.needsReview).length, [items]);

  /* ── entry ──────────────────────────────────────────────────────────── */
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (draft.ownerType === "VEHICLE" && !draft.vehiclePublicId) e.vehiclePublicId = "Pick a vehicle";
    if (draft.ownerType === "DRIVER" && !draft.driverPublicId) e.driverPublicId = "Pick a driver";
    if (!draft.category) e.category = "Which document?";
    // Both rules come from the fetched catalogue, so they follow the backend enum rather than a
    // hardcoded list here. The server validates them again and is the authority.
    if (selectedCat?.needsState && !draft.stateCode.trim()) {
      e.stateCode = "Which state issued it?";
    }
    if (selectedCat?.needsExitDeadline && !draft.exitDeadline) {
      e.exitDeadline = "When must the vehicle be back across?";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await fleetService.createDocument({
        vehiclePublicId: draft.ownerType === "VEHICLE" ? draft.vehiclePublicId : null,
        driverPublicId: draft.ownerType === "DRIVER" ? draft.driverPublicId : null,
        category: draft.category,
        documentNumber: draft.documentNumber.trim() || null,
        issuingAuthority: draft.issuingAuthority.trim() || null,
        stateCode: draft.stateCode.trim() || null,
        borderPost: draft.borderPost.trim() || null,
        issuedOn: draft.issuedOn || null,
        validFrom: draft.validFrom || null,
        validUntil: draft.validUntil || null,
        exitDeadline: draft.exitDeadline || null,
        notes: draft.notes.trim() || null,
      });
      setDraft(blankDoc(draft));   // keeps owner / asset / authority / state for the next paper
      showToast("Document recorded.", "success");
      await load();
      numberRef.current?.focus();
    } catch (e) {
      showToast(errMsg(e, "Could not record this document."), "error");
    } finally { setSaving(false); }
  };

  /** Enter saves (one-row repeat entry, like the expense and cash grids); Esc clears. */
  const onEntryKeyDown = (e) => {
    if (saving) return;
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      submitDraft();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(blankDoc(draft));
      setErrors({});
    }
  };

  const doRenew = async () => {
    if (!renewForm.validUntil) return showToast("The new validity date is required.", "error");
    try {
      await fleetService.renewDocument(renewTarget.publicId, {
        category: renewTarget.category,       // server re-derives owner + category from the original
        validUntil: renewForm.validUntil,
        issuedOn: renewForm.issuedOn || null,
        documentNumber: renewForm.documentNumber.trim() || null,
        vehiclePublicId: renewTarget.vehiclePublicId || null,
        driverPublicId: renewTarget.driverPublicId || null,
      });
      showToast("Renewed. The old certificate is kept.", "success");
      setRenewTarget(null);
      setRenewForm({ validUntil: "", documentNumber: "", issuedOn: "" });
      load();
    } catch (e) { showToast(errMsg(e, "Could not renew."), "error"); }
  };

  const doRevoke = async () => {
    if (!revokeReason.trim()) return showToast("A revocation needs a reason.", "error");
    try {
      await fleetService.revokeDocument(revokeTarget.publicId, revokeReason.trim());
      showToast("Revoked.", "success");
      setRevokeTarget(null);
      setRevokeReason("");
      load();
    } catch (e) { showToast(errMsg(e, "Could not revoke."), "error"); }
  };

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <PageShell>
      <PageHeader
        icon={ShieldCheck}
        title="Compliance"
        subtitle="Permits, insurance, fitness, licences — and when each of them lapses."
      >
        <button onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-800">
          <RotateCcw className="h-4 w-4" /> Refresh
        </button>
      </PageHeader>

      <StatCardRow className="lg:grid-cols-4 xl:grid-cols-4">
        <StatCard label="Expired" value={expiredCount} icon={<AlertTriangle />} tone="rose" />
        <StatCard label="Expiring soon" value={expiringCount} icon={<CalendarClock />} tone="amber" />
        <StatCard label="Needs review" value={reviewCount} icon={<FileWarning />} tone="indigo" />
        <StatCard label="On this page" value={items.length} icon={<ShieldCheck />} tone="blue" />
      </StatCardRow>

      {/* The backfill's worklist, surfaced rather than buried in a filter dropdown. */}
      {reviewCount > 0 && !needsReviewOnly && (
        <div className="mb-6 flex flex-wrap items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[13px] text-indigo-800">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">
            Some documents were carried over from the old expiry-date fields. Only the date was ever
            recorded — the number, issue date and issuing authority were unknown and were deliberately
            not invented. They need filling in.
          </p>
          <button onClick={() => { setNeedsReviewOnly(true); setPage(0); }}
            className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
            Show them
          </button>
        </div>
      )}

      {/* ── quick entry ── */}
      {canCreate && (
        <div className="mb-6">
          <Panel
            icon={Plus}
            title="Record a document"
            description="Owner, asset, authority and state stay put after each save. Enter records; Esc clears."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12" onKeyDown={onEntryKeyDown}>
              <Field label="Belongs to" required className="md:col-span-2">
                <select className={fieldCls} value={draft.ownerType}
                        onChange={(e) => set({ ownerType: e.target.value, category: "" })}>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="DRIVER">Driver</option>
                </select>
              </Field>

              {draft.ownerType === "VEHICLE" ? (
                <Field label="Vehicle" required error={errors.vehiclePublicId} className="md:col-span-3">
                  <select className={fieldCls} value={draft.vehiclePublicId}
                          onChange={(e) => set({ vehiclePublicId: e.target.value })}>
                    <option value="">Select…</option>
                    {vehicles.map((v) => <option key={v.publicId} value={v.publicId}>{v.label}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Driver" required error={errors.driverPublicId} className="md:col-span-3">
                  <select className={fieldCls} value={draft.driverPublicId}
                          onChange={(e) => set({ driverPublicId: e.target.value })}>
                    <option value="">Select…</option>
                    {drivers.map((d) => <option key={d.publicId} value={d.publicId}>{d.label}</option>)}
                  </select>
                </Field>
              )}

              {/* Categories filtered by owner — a PSV badge is not a vehicle document, and offering
                  it there only produces a 400 the user has to decode. */}
              <Field label="Document" required error={errors.category} className="md:col-span-3">
                <select className={fieldCls} value={draft.category}
                        onChange={(e) => set({ category: e.target.value })}>
                  <option value="">Select…</option>
                  {catsForOwner.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </Field>

              <Field label="Number" className="md:col-span-2">
                <input ref={numberRef} className={fieldCls} value={draft.documentNumber}
                       onChange={(e) => set({ documentNumber: e.target.value })} />
              </Field>

              <div className="flex items-end md:col-span-2">
                <Button className="w-full" disabled={saving} onClick={submitDraft}>
                  {saving ? "…" : "Record"}
                </Button>
              </div>

              <Field label="Valid until" className="md:col-span-2"
                     note={!draft.validUntil ? "Leave blank for a lifetime document" : undefined}>
                <input type="date" className={fieldCls} value={draft.validUntil}
                       onChange={(e) => set({ validUntil: e.target.value })} />
              </Field>

              <Field label="Issued on" className="md:col-span-2">
                <input type="date" className={fieldCls} value={draft.issuedOn}
                       onChange={(e) => set({ issuedOn: e.target.value })} />
              </Field>

              <Field label="Issuing authority" className="md:col-span-3">
                <input className={fieldCls} placeholder="RTO Dehradun" value={draft.issuingAuthority}
                       onChange={(e) => set({ issuingAuthority: e.target.value })} />
              </Field>

              {/* Both of these appear only when the fetched category says they are required. */}
              {selectedCat?.needsState && (
                <Field label="Issuing state" required error={errors.stateCode} className="md:col-span-2"
                       note="A permit for one state is not a permit for another">
                  <input className={fieldCls} placeholder="Uttarakhand" value={draft.stateCode}
                         onChange={(e) => set({ stateCode: e.target.value })} />
                </Field>
              )}

              {selectedCat?.needsExitDeadline && (
                <>
                  <Field label="Border post" className="md:col-span-2">
                    <input className={fieldCls} placeholder="Sunauli" value={draft.borderPost}
                           onChange={(e) => set({ borderPost: e.target.value })} />
                  </Field>
                  <Field
                    label="Must exit by" required error={errors.exitDeadline} className="md:col-span-2"
                    note={<><Globe2 className="mt-px h-3 w-3 shrink-0" /> Overstaying is a fine — this is not the validity date</>}
                    noteTone="amber"
                  >
                    <input type="date" className={fieldCls} value={draft.exitDeadline}
                           onChange={(e) => set({ exitDeadline: e.target.value })} />
                  </Field>
                </>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── filters ── */}
      <div className="mb-6">
        <Panel icon={Search} title="Filters">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <Field label="Search" className="md:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${fieldCls} pl-9`} placeholder="Number, authority, vehicle or driver"
                       value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </div>
            </Field>
            <Field label="Status" className="md:col-span-3">
              <select className={fieldCls} value={statusF}
                      onChange={(e) => { setStatusF(e.target.value); setPage(0); }}>
                <option value="">Everything current</option>
                <option value="EXPIRED">Expired</option>
                <option value="EXPIRING">Expiring soon</option>
                <option value="ACTIVE">Valid</option>
                <option value="SUPERSEDED">Superseded (history)</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </Field>
            <Field label="Document" className="md:col-span-3">
              <select className={fieldCls} value={categoryF}
                      onChange={(e) => { setCategoryF(e.target.value); setPage(0); }}>
                <option value="">All documents</option>
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <div className="flex items-end md:col-span-2">
              <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={needsReviewOnly}
                       onChange={(e) => { setNeedsReviewOnly(e.target.checked); setPage(0); }} />
                Needs review
              </label>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── list ── */}
      {loading ? (
        <Panel icon={ShieldCheck} title="Documents"><LoadingState label="Loading…" /></Panel>
      ) : items.length === 0 ? (
        <Panel icon={ShieldCheck} title="Documents">
          <EmptyState icon={ShieldCheck} title="Nothing here"
                      hint="Record a vehicle's insurance or a driver's licence using the panel above." />
        </Panel>
      ) : (
        <Panel icon={ShieldCheck} title="Documents" description="Soonest to lapse first.">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((d) => (
              <EntityCard key={d.publicId} tone={cardTone(d)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <CodeChip>{d.vehicleNumber || d.driverName}</CodeChip>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_TONE[d.status]}`}>
                        {d.statusLabel}
                      </span>
                      {d.blocking && (
                        <span title="An expired instance of this refuses an assignment">
                          <Ban className="h-3.5 w-3.5 text-rose-500" />
                        </span>
                      )}
                      {d.needsReview && (
                        <Badge className="bg-indigo-100 text-indigo-700">needs review</Badge>
                      )}
                      {d.supersedesPublicId && (
                        <span title="Renewal of an earlier certificate">
                          <History className="h-3.5 w-3.5 text-slate-400" />
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm font-bold text-slate-800">{d.categoryLabel}</p>
                    <p className="truncate text-xs text-slate-500">
                      {d.documentNumber || <span className="italic text-slate-400">no number on record</span>}
                      {d.issuingAuthority ? ` · ${d.issuingAuthority}` : ""}
                      {d.stateCode ? ` · ${d.stateCode}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-slate-700">
                      {d.validUntil ? fmtDate(d.validUntil) : "—"}
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${
                      d.daysLeft == null ? "text-slate-400"
                        : d.daysLeft < 0 ? "text-rose-600"
                        : d.daysLeft <= 30 ? "text-amber-600" : "text-emerald-600"}`}>
                      {d.daysLeft == null ? "lifetime"
                        : d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue`
                        : `${d.daysLeft}d left`}
                    </p>
                  </div>
                </div>

                {/* A Nepal entry's exit deadline is NOT its validity — the paper can be valid for a
                    month while the vehicle must be back in seven days. */}
                {d.exitDeadline && (
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                    d.exitDaysLeft != null && d.exitDaysLeft < 3
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-100 bg-amber-50 text-amber-700"}`}>
                    <Globe2 className="h-3.5 w-3.5 shrink-0" />
                    Must exit {d.borderPost ? `via ${d.borderPost} ` : ""}by {fmtDate(d.exitDeadline)}
                    {d.exitDaysLeft != null && ` · ${d.exitDaysLeft}d`}
                  </div>
                )}

                {d.revokeReason && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                    Revoked — {d.revokeReason}
                  </div>
                )}

                {canUpdate && d.status !== "SUPERSEDED" && (
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => setAttachTarget(d)} title="Scans"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50">
                      <Paperclip className="h-3.5 w-3.5" /> Scans
                    </button>
                    <button onClick={() => setRevokeTarget(d)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                      Revoke
                    </button>
                    <button
                      onClick={() => {
                        setRenewTarget(d);
                        setRenewForm({ validUntil: "", documentNumber: d.documentNumber || "", issuedOn: todayDateInput() });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                      <PencilLine className="h-3.5 w-3.5" /> Renew
                    </button>
                  </div>
                )}
              </EntityCard>
            ))}
          </div>
        </Panel>
      )}

      {pagination && !loading && items.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <CommonPagination
            pageIndex={pagination?.page ?? page}
            pageSize={pagination?.size ?? size}
            totalElements={pagination?.totalElements ?? items.length}
            totalPages={pagination?.totalPages ?? 1}
            goToPage={setPage}
            changePageSize={(s) => { setSize(s); setPage(0); }}
          />
        </div>
      )}

      {/* Renewal is NOT an edit, and the wording says so — the old certificate stays on record. */}
      <ConfirmDialog
        open={!!renewTarget}
        onOpenChange={(open) => { if (!open) setRenewTarget(null); }}
        variant="default"
        title={`Renew ${renewTarget?.categoryLabel || "document"}?`}
        description={
          <div className="space-y-3">
            <p className="flex gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              This records a NEW certificate and marks the current one superseded. The old number,
              authority and validity are kept — that is what answers "what was valid on this past date".
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="New valid until" required>
                <input type="date" className={fieldCls} value={renewForm.validUntil}
                       onChange={(e) => setRenewForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </Field>
              <Field label="Issued on">
                <input type="date" className={fieldCls} value={renewForm.issuedOn}
                       onChange={(e) => setRenewForm((f) => ({ ...f, issuedOn: e.target.value }))} />
              </Field>
              <Field label="New number">
                <input className={fieldCls} value={renewForm.documentNumber}
                       onChange={(e) => setRenewForm((f) => ({ ...f, documentNumber: e.target.value }))} />
              </Field>
            </div>
          </div>
        }
        confirmLabel="Renew"
        onConfirm={doRenew}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) { setRevokeTarget(null); setRevokeReason(""); } }}
        title={`Revoke ${revokeTarget?.categoryLabel || "document"}?`}
        description={
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Marks it cancelled by the authority or by you. It stays on record, and the vehicle or
              driver will fail a compliance check for this document from now on.
            </p>
            <input autoFocus className={fieldCls} placeholder="Reason"
                   value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
          </div>
        }
        confirmLabel="Revoke"
        onConfirm={doRevoke}
      />

      {attachTarget && (
        <AttachmentsDialog
          ownerType="DOCUMENT"
          ownerId={attachTarget.publicId}
          title={`Scans — ${attachTarget.categoryLabel}${attachTarget.documentNumber ? ` · ${attachTarget.documentNumber}` : ""}`}
          onClose={() => setAttachTarget(null)}
        />
      )}
    </PageShell>
  );
}
