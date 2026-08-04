// src/features/leads/components/ImportLeadsModal.jsx
//
// Bulk lead import — CSV / Excel, preview-then-confirm.
//
// The preview step is not decoration: POST /leads/import/preview writes nothing and returns the
// same report shape as the commit, so a file with the wrong column order or another CRM's stage
// vocabulary is caught while it is still a table on screen instead of 300 leads somebody has to
// find and trash.
//
// Error handling follows the shared contract: the axios interceptor is SILENT on 400/404/409 by
// design, and "missing required column" is a 400 — so every failure here must be rendered at the
// call site or the user sees nothing happen at all.

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload, X, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  XCircle, MinusCircle, Loader2, ArrowLeft,
} from "lucide-react";
import { leadService } from "../api/leadService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { downloadBlob } from "@shared/lib/download";

const FONT = "'Plus Jakarta Sans',system-ui,sans-serif";

// Client-side guard only. The real limit is spring.servlet.multipart.max-file-size=11MB; catching
// it here turns an opaque 413 into a sentence the user can act on.
const MAX_FILE_MB = 10;

const OUTCOME = {
  READY:     { label: "Ready",     cls: "bg-blue-100 text-blue-700",       Icon: CheckCircle2 },
  IMPORTED:  { label: "Imported",  cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  DUPLICATE: { label: "Duplicate", cls: "bg-amber-100 text-amber-700",     Icon: AlertTriangle },
  INVALID:   { label: "Invalid",   cls: "bg-red-100 text-red-700",         Icon: XCircle },
  SKIPPED:   { label: "Skipped",   cls: "bg-slate-100 text-slate-600",     Icon: MinusCircle },
};

function OutcomeBadge({ outcome }) {
  const cfg = OUTCOME[outcome] || OUTCOME.SKIPPED;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <Icon size={13} /> {cfg.label}
    </span>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${tone}`}>
      <div className="text-lg font-extrabold leading-none">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-70 mt-1">{label}</div>
    </div>
  );
}

export default function ImportLeadsModal({ open, onClose, onImported }) {
  const { showToast } = useToast();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  if (!open) return null;

  const committed = report?.committed;

  function reset() {
    setFile(null);
    setReport(null);
    setError("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    // Tell the list to refetch only if leads actually landed.
    if (committed && report?.importedCount > 0) onImported?.();
    reset();
    onClose?.();
  }

  function pickFile(chosen) {
    if (!chosen) return;
    setError("");
    setReport(null);
    if (chosen.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_FILE_MB} MB. Split it into smaller files.`);
      setFile(null);
      return;
    }
    setFile(chosen);
  }

  async function runPreview() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await leadService.previewImport(file);
      setReport(res.data?.data ?? null);
    } catch (err) {
      if (!isAlreadyReported(err)) {
        setError(getErrorMessage(err, "This file could not be read."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await leadService.importLeads(file);
      const result = res.data?.data ?? null;
      setReport(result);
      if (result?.importedCount > 0) {
        showToast(`${result.importedCount} lead${result.importedCount === 1 ? "" : "s"} imported.`, "success");
      } else {
        showToast("No leads were imported — see the report.", "error");
      }
    } catch (err) {
      if (!isAlreadyReported(err)) {
        setError(getErrorMessage(err, "The import could not be completed."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function getTemplate() {
    try {
      const res = await leadService.downloadImportTemplate();
      downloadBlob(res.data, "lead-import-template.csv");
    } catch (err) {
      if (!isAlreadyReported(err)) {
        showToast(getErrorMessage(err, "Could not download the template."), "error");
      }
    }
  }

  const rows = report?.rows ?? [];
  // After a commit the interesting rows are the ones that did NOT import; before it, everything.
  const problemRows = rows.filter((r) => r.outcome !== "READY" && r.outcome !== "IMPORTED");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
         style={{ fontFamily: FONT }}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Upload size={17} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Import Leads</h2>
              <p className="text-xs font-medium text-slate-500">
                {committed ? "Import complete" : report ? "Review before importing" : "CSV or Excel file"}
              </p>
            </div>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Step 1: choose a file ─────────────────────────────── */}
          {!report && (
            <>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                  dragging ? "border-blue-400 bg-blue-50/60" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <FileSpreadsheet size={30} className="text-slate-400" />
                {file ? (
                  <>
                    <span className="text-sm font-bold text-slate-700">{file.name}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB — click to choose a different file
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-slate-700">Drop your file here, or click to browse</span>
                    <span className="text-xs font-medium text-slate-500">.csv, .xlsx or .xls — up to 2,000 rows</span>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <Download size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  Not sure about the columns?{" "}
                  <button onClick={getTemplate} className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2">
                    Download the template
                  </button>
                  {" "}— it has the exact headers and one example row.{" "}
                  <span className="text-slate-500">
                    Customer Name, Phone, Lead Source and Lead Type are required. Dates are
                    YYYY-MM-DD or DD/MM/YYYY. Phone needs a country code (+91…), not a leading 0.
                  </span>
                </p>
              </div>
            </>
          )}

          {/* ── Step 2/3: the report ──────────────────────────────── */}
          {report && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {committed
                  ? <Stat value={report.importedCount} label="Imported" tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  : <Stat value={report.readyCount} label="Ready" tone="border-blue-200 bg-blue-50 text-blue-700" />}
                <Stat value={report.duplicateCount} label="Duplicates" tone="border-amber-200 bg-amber-50 text-amber-700" />
                <Stat value={report.invalidCount} label="Invalid" tone="border-red-200 bg-red-50 text-red-700" />
                <Stat value={report.skippedCount} label="Skipped" tone="border-slate-200 bg-slate-50 text-slate-600" />
              </div>

              {report.remainingQuota != null && !committed && report.readyCount > report.remainingQuota && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs font-bold text-amber-800">
                    Your plan has {report.remainingQuota} lead slot{report.remainingQuota === 1 ? "" : "s"} left
                    but {report.readyCount} rows are ready. The rows past the limit will be skipped.
                  </p>
                </div>
              )}

              {report.ignoredHeaders?.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                  <MinusCircle size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs font-medium text-slate-600">
                    <span className="font-bold text-slate-700">Columns ignored:</span>{" "}
                    {report.ignoredHeaders.join(", ")} — these did not match any known field.
                  </p>
                </div>
              )}

              {problemRows.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-emerald-800">
                    {committed
                      ? `All ${report.importedCount} rows imported cleanly.`
                      : `All ${report.totalRows} rows look good and are ready to import.`}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                      {committed ? "Rows not imported" : "Rows needing attention"} ({problemRows.length})
                    </h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {problemRows.map((row) => (
                      <div key={row.rowNumber} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-xs font-extrabold text-slate-400 tabular-nums pt-0.5 w-12 shrink-0">
                          Row {row.rowNumber}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-700 truncate">
                              {row.customerName || <span className="text-slate-400 italic">No name</span>}
                            </span>
                            {row.phone && <span className="text-xs font-medium text-slate-500">{row.phone}</span>}
                            <OutcomeBadge outcome={row.outcome} />
                          </div>
                          {row.messages?.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {row.messages.map((m, i) => (
                                <li key={i} className="text-xs font-medium text-slate-500">• {m}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs font-bold text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 bg-slate-50/60">
          <div className="text-xs font-medium text-slate-500">
            {report && !committed && `${report.totalRows} row${report.totalRows === 1 ? "" : "s"} read`}
          </div>
          <div className="flex items-center gap-2">
            {report && !committed && (
              <button
                onClick={reset}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-bold disabled:opacity-50"
              >
                <ArrowLeft size={14} /> Choose another file
              </button>
            )}

            {!report && (
              <button
                onClick={runPreview}
                disabled={!file || busy}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold shadow-md shadow-blue-200 transition-all"
              >
                {busy ? <><Loader2 size={15} className="animate-spin" /> Checking…</> : <>Check file</>}
              </button>
            )}

            {report && !committed && (
              <button
                onClick={runImport}
                disabled={busy || report.readyCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold shadow-md shadow-blue-200 transition-all"
              >
                {busy
                  ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
                  : <>Import {report.readyCount} lead{report.readyCount === 1 ? "" : "s"}</>}
              </button>
            )}

            {committed && (
              <button
                onClick={close}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
