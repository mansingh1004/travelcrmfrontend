// src/features/fleet/components/AttachmentsDialog.jsx
// The paperclip behind fleet money and compliance: receipt images on an expense, certificate
// scans on a document, the photographed signed sheet on a settlement.
//
// Bytes live in Postgres and only travel through the authenticated /file endpoint — a row here is
// metadata only. Evidence is APPEND-ONLY once the owning money is signed: the server refuses the
// delete and `deletable:false` hides the button, but upload stays available forever — a late
// receipt surfacing after the sheet was signed is normal life.
import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Eye, Trash2, Lock, FileText, Image as ImageIcon } from "lucide-react";

import fleetService from "../api/fleetService";
import { openBlob } from "@shared/lib/download";
import { hasPermission, P } from "@shared/lib/access";
import {
  Button, Badge, LoadingState, EmptyState, ConfirmDialog,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  useToast, errMsg, fmtDateTime,
} from "./fleetUi";

function prettySize(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/**
 * @param ownerType EXPENSE | DOCUMENT | SETTLEMENT
 * @param ownerId   the owner's publicId
 * @param title     dialog heading, e.g. "Receipts — Fuel · ₹4,200"
 * @param onChange  called after an upload or delete lands, so the opener can refresh a count
 */
export default function AttachmentsDialog({ ownerType, ownerId, title, onClose, onChange }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [items, setItems] = useState(null);   // null = loading
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canUpload = hasPermission(P.FLEET_CREATE) || hasPermission(P.FLEET_UPDATE);
  const canDelete = hasPermission(P.FLEET_DELETE);

  const load = useCallback(() => {
    return fleetService.listAttachments(ownerType, ownerId)
      .then((rows) => setItems(rows || []))
      .catch((e) => {
        setItems([]);
        showToast(errMsg(e, "Failed to load attachments."), "error");
      });
  }, [ownerType, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const pickFile = () => fileRef.current?.click();

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";               // same file can be picked again after a failure
    if (!file) return;
    setBusy(true);
    try {
      await fleetService.uploadAttachment(ownerType, ownerId, file);
      showToast("Attached.", "success");
      await load();
      onChange?.();
    } catch (e) {
      showToast(errMsg(e, "Could not attach the file."), "error");
    } finally { setBusy(false); }
  };

  const view = async (a) => {
    try {
      openBlob(await fleetService.fetchAttachmentBlob(a.publicId));
    } catch (e) {
      showToast(errMsg(e, "Could not open the file."), "error");
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await fleetService.deleteAttachment(deleteTarget.publicId);
      showToast("Removed.", "success");
      setDeleteTarget(null);
      await load();
      onChange?.();
    } catch (e) {
      // The server names the refusal — signed money keeps its evidence.
      showToast(errMsg(e, "Could not remove the file."), "error");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-blue-600" /> {title || "Attachments"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {items === null ? (
            <LoadingState label="Loading…" />
          ) : items.length === 0 ? (
            <EmptyState icon={Paperclip} title="Nothing attached yet"
                        hint="A photo of the receipt is what wins the argument six months later." />
          ) : (
            <ul className="space-y-2">
              {items.map((a) => {
                const isImage = (a.contentType || "").startsWith("image/");
                const Icon = isImage ? ImageIcon : FileText;
                return (
                  <li key={a.publicId}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-700" title={a.sha256 ? `SHA-256 ${a.sha256}` : undefined}>
                        {a.fileName || "file"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {prettySize(a.sizeBytes)} · {fmtDateTime(a.uploadedAt)}
                        {a.uploadedBy ? ` · ${a.uploadedBy}` : ""}
                      </p>
                    </div>
                    {!a.deletable && (
                      <span title="Evidence on signed money — append-only now">
                        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </span>
                    )}
                    <button onClick={() => view(a)} title="Open"
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50">
                      <Eye className="h-4 w-4" />
                    </button>
                    {canDelete && a.deletable && (
                      <button onClick={() => setDeleteTarget(a)} title="Remove"
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <input ref={fileRef} type="file" className="hidden"
                 accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFile} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          {canUpload && (
            <Button onClick={pickFile} disabled={busy}>
              <Upload /> {busy ? "Working…" : "Attach file"}
            </Button>
          )}
        </DialogFooter>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Remove this file?"
          description={`“${deleteTarget?.fileName || "file"}” will be removed from this record.`}
          confirmLabel="Remove"
          busy={busy}
          onConfirm={doDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
