// src/shared/hooks/usePdfDownload.js
//
// One place that knows how to pull a server-rendered PDF down as a Blob and hand it to the
// browser — with loader state the UI can mount <PdfDownloadLoader/> on. Quotations use it
// today; invoices/vouchers/receipts can call the same hook with their own endpoint later
// instead of re-writing the blob/anchor dance.
//
// Progress honesty: a real percentage exists only while bytes are streaming AND the response
// carries a usable total (Content-Length). Server-side PDF generation spends most of its time
// before the first byte, so `progressSupported` stays false until axios reports a total — the
// loader shows an indeterminate bar until then. No fake numbers.

import { useCallback, useRef, useState } from "react";
import API from "@shared/api/http";
import { downloadBlob, hydrateBlobError } from "@shared/lib/download";

export function usePdfDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressSupported, setProgressSupported] = useState(false);
  // Single-flight guard: state updates are async, a ref is not — double clicks land here
  // before the first render with isDownloading=true.
  const activeRef = useRef(false);

  /**
   * @param {object}  opts
   * @param {string}  opts.endpoint  API path returning a PDF blob, e.g. `/quotations/{id}/pdf`
   * @param {string}  opts.fileName  suggested file name (use a readable business code, not a UUID)
   * @param {object} [opts.params]   query params (e.g. one-off `style` override)
   * @param {number} [opts.timeout]  ms; server-side rendering can exceed the client default
   * @returns {Promise<boolean>} true when the file reached the browser; throws on failure
   */
  const downloadPdf = useCallback(async ({ endpoint, fileName, params, timeout = 120000 } = {}) => {
    if (!endpoint) throw new Error("usePdfDownload: endpoint is required.");
    if (activeRef.current) return false;   // a download is already running — ignore the click
    activeRef.current = true;
    setIsDownloading(true);
    setProgress(0);
    setProgressSupported(false);

    try {
      const res = await API.get(endpoint, {
        responseType: "blob",
        params,
        timeout,
        onDownloadProgress: (e) => {
          const total = e?.total ?? e?.event?.total;
          if (total > 0) {
            setProgressSupported(true);
            setProgress(Math.min(100, Math.round((e.loaded / total) * 100)));
          }
        },
      });
      downloadBlob(res.data, fileName || "document.pdf");
      return true;
    } catch (error) {
      // Blob endpoints return their JSON ApiError as a Blob too — rehydrate it so the
      // caller's getErrorMessage() can read message/code as usual.
      await hydrateBlobError(error);
      throw error;
    } finally {
      activeRef.current = false;
      setIsDownloading(false);
      setProgress(0);
      setProgressSupported(false);
    }
  }, []);

  return { downloadPdf, isDownloading, progress, progressSupported };
}
