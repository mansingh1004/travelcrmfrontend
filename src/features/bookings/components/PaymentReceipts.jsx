// src/features/bookings/components/PaymentReceipts.jsx
// ─────────────────────────────────────────────────────────────
// Optional proof attached to one payment-ledger row — the counterfoil photo, the UPI screenshot,
// the transfer advice.
//
// OPTIONAL is the operative word: nothing about recording a payment requires a file, there is no
// minimum, and a ledger row with no receipt is a complete row. This panel exists so proof CAN be
// kept where it belongs, not to make keeping it a condition of booking the money.
//
// The bytes live in Postgres and are served only through an authenticated, ownership-checked
// endpoint — there is no public URL. That is why viewing goes through the shared axios client and
// opens a blob rather than pointing an <img src> at the path: a bare src would be unauthenticated
// and 401. It is also why a thumbnail grid is deliberately NOT rendered here — that would fetch
// every blob of every row on load.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiPaperclip, FiUpload, FiTrash2, FiEye, FiFileText, FiImage,
} from "react-icons/fi";
import bookingService from "../api/bookingService";
import { useToast } from "@shared/ui/toast";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { openBlob, hydrateBlobError } from "@shared/lib/download";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,application/pdf";

const fmtSize = (bytes) => {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PaymentReceipts({ bookingId, payment, canDelete = false, onCountChange }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const paymentId = payment?.publicId;

  const load = useCallback(async () => {
    if (!bookingId || !paymentId) return;
    setLoading(true);
    try {
      const res = await bookingService.getPaymentAttachments(bookingId, paymentId);
      const list = res.data?.data ?? res.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      setFiles(arr);
      onCountChange?.(paymentId, arr.length);
    } catch (error) {
      // A receipt list that failed to load must not shout: the user opened a panel, they did not
      // ask for a report. The ledger row itself is unaffected.
      if (!isAlreadyReported(error)) setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId, paymentId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const handlePick = () => fileRef.current?.click();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    // Reset immediately so picking the SAME file twice in a row still fires onChange.
    e.target.value = "";
    if (!file) return;

    // Checked here as well as server-side purely to save the user a 10 MB round-trip that ends in
    // a rejection. The server remains the authority on both rules.
    if (file.size > MAX_BYTES) {
      showToast("File exceeds the 10 MB limit.", "error");
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      showToast("Only JPG, PNG, WEBP or PDF files are allowed.", "error");
      return;
    }

    setUploading(true);
    try {
      await bookingService.uploadPaymentAttachment(bookingId, paymentId, file);
      showToast("Receipt attached.", "success");
      await load();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      // A 403 here is the tenant's STORAGE QUOTA, not a missing permission — uploading rides the
      // same grant as recording the payment, which the user demonstrably has.
      showToast(getErrorMessage(error, "Could not attach the receipt."), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (att) => {
    setBusyId(att.publicId);
    try {
      const res = await bookingService.getPaymentAttachmentFile(bookingId, paymentId, att.publicId);
      openBlob(res.data);
    } catch (error) {
      await hydrateBlobError(error);
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Could not open the receipt."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (att) => {
    setBusyId(att.publicId);
    try {
      await bookingService.deletePaymentAttachment(bookingId, paymentId, att.publicId);
      showToast("Receipt removed.", "success");
      await load();
    } catch (error) {
      if (isAlreadyReported(error)) return;
      showToast(getErrorMessage(error, "Could not remove the receipt."), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <FiPaperclip className="w-3.5 h-3.5" />
          Receipts {files.length > 0 && <span className="text-slate-400">({files.length})</span>}
        </span>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={handlePick}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 text-[11px] font-bold transition-all disabled:opacity-50"
        >
          {uploading ? (
            <><span className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /> Uploading…</>
          ) : (
            <><FiUpload className="w-3 h-3" /> Attach</>
          )}
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-slate-400 font-medium py-1">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-[11px] text-slate-400 font-medium py-1">
          No receipt attached — optional.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((att) => {
            const isPdf = (att.contentType || "").includes("pdf");
            return (
              <li
                key={att.publicId}
                className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-1.5"
              >
                {isPdf
                  ? <FiFileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  : <FiImage className="w-3.5 h-3.5 text-blue-500 shrink-0" />}

                <span className="text-[11px] font-semibold text-slate-700 truncate flex-1" title={att.fileName}>
                  {att.fileName || "receipt"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">{fmtSize(att.sizeBytes)}</span>

                <button
                  onClick={() => handleView(att)}
                  disabled={busyId === att.publicId}
                  title="Open"
                  className="w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all disabled:opacity-40"
                >
                  <FiEye className="w-3 h-3" />
                </button>

                {/* Removing evidence is gated the same as amending the entry itself, and the server
                    additionally refuses once the booking's ledger has frozen — `deletable` carries
                    that second answer so the control is hidden rather than offered and refused. */}
                {canDelete && att.deletable !== false && (
                  <button
                    onClick={() => handleDelete(att)}
                    disabled={busyId === att.publicId}
                    title="Remove"
                    className="w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
