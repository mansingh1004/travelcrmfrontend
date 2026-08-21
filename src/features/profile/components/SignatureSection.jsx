// src/features/profile/components/SignatureSection.jsx
//
// Authorised-signatory capture, as one tab in Company Profile.
//
// ═══ ISOLATION — READ THIS BEFORE EDITING ══════════════════════════════════════════════════════
// This component owns ALL of its state and calls ONLY signatureService. It deliberately does not
// touch EditProfileTab's `form` object and does not call companyService.update().
//
// That is not tidiness. companyService.update() sends the CompanyDTO, and the quotation PDF's
// header block is rendered from that DTO — company name, address, GSTIN. Anything added to that
// payload is one mapper change away from breaking document generation for a reason nobody would
// think to look for. The signature travels on its own endpoints so the two can never interfere.
//
// It also renders OUTSIDE the Edit Profile <form>, which matters mechanically: inside it, a button
// missing type="button" would submit the company profile, and Enter in a text field would too.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileSignature as FiSignature, PenTool as FiPen, Upload as FiUpload, Stamp as FiStamp,
  Trash2 as FiTrash, Check as FiCheck, Loader2 as FiLoader, TriangleAlert as FiAlert,
  Save as FiSave, X as FiX, Info as FiInfo,
} from "lucide-react";

import { getErrorMessage } from "@shared/api/apiError";
import signatureService, { SIGNATURE_MAX_BYTES, SIGNATURE_ACCEPT } from "../api/signatureService";
import SignaturePad from "./SignaturePad";

const unwrap = (r) => r?.data?.data ?? r?.data;

const EMPTY = {
  hasSignature: false,
  signatureUrl: null,
  signatoryName: "",
  signatoryDesignation: "",
  sealUrl: null,
  signatureEnabled: true,
  updatedAt: null,
};

/* ── Opaque-background detection ───────────────────────────────────────────────────────────────
   Nearly everyone uploads a photo or a scan of a signature on white paper. That image has no
   transparency, so it arrives in the PDF as a white rectangle sitting on top of whatever the
   footer draws behind it — a defect nobody sees until the customer opens the document.

   Detected by sampling the four corners: a signature occupies the middle, so the corners are
   background by definition. Opaque corners mean no transparency; near-white opaque corners mean
   the white-box case specifically.

   JPEG is decided without sampling — the format has no alpha channel at all, so it is opaque by
   definition.

   KNOWN LIMIT: this cannot see an image that is transparent at the very edge but has an opaque
   plate behind the ink. Catching that needs a full alpha histogram. Warning on the common case is
   worth more than pretending to be exhaustive, and the warning never blocks the upload. */
const BLOCK = 8;
async function looksOpaque(file) {
  if (file.type === "image/jpeg") return { opaque: true, white: true };

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const w = canvas.width;
    const h = canvas.height;
    if (w < BLOCK * 2 || h < BLOCK * 2) return { opaque: false, white: false };

    const corners = [[0, 0], [w - BLOCK, 0], [0, h - BLOCK], [w - BLOCK, h - BLOCK]];
    let allOpaque = true;
    let allWhite = true;

    corners.forEach(([x, y]) => {
      const { data } = ctx.getImageData(x, y, BLOCK, BLOCK);
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
      }
      if (a / n <= 250) allOpaque = false;
      if (r / n <= 235 || g / n <= 235 || b / n <= 235) allWhite = false;
    });

    return { opaque: allOpaque, white: allOpaque && allWhite };
  } catch {
    // A file we cannot decode is not a file we can judge. Say nothing rather than warn wrongly.
    return { opaque: false, white: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ── THE PREVIEW ───────────────────────────────────────────────────────────────────────────────
   A mock of the quotation footer, at roughly the size the block occupies on the page.

   This is the feature's real quality gate. A signature inspected in a 400px-wide editing box looks
   fine; the same image at its true ~160px printed width can be an unreadable smear, and without
   this the first person to find that out is the customer who received the PDF. Right-aligned,
   because that is where the block sits on the document. */
function QuotationPreview({ companyName, signatureUrl, sealUrl, signatoryName, designation, enabled }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <FiInfo className="h-3 w-3" /> How it will appear on a quotation
      </div>

      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4">
        <div className="flex justify-end">
          <div className="w-56 text-right">
            <p className="text-[11px] font-semibold text-slate-600">
              For {companyName || "Your Company"}
            </p>

            <div className="relative mt-1 flex h-16 items-end justify-end">
              {/* The seal sits BEHIND and slightly left, the way a rubber stamp overlaps a signed
                  line on paper. Low opacity so it never competes with the signature. */}
              {sealUrl && (
                <img
                  src={sealUrl} alt=""
                  className="pointer-events-none absolute bottom-1 right-16 h-14 w-14 object-contain opacity-60"
                />
              )}
              {signatureUrl ? (
                <img
                  src={signatureUrl}
                  alt="Authorised signature"
                  /* max-h, not a fixed height: the export is trimmed to its ink, so its aspect
                     ratio is whatever was signed. Constraining one axis lets it size naturally. */
                  className="relative max-h-14 max-w-full object-contain"
                />
              ) : (
                <span className="relative text-[10px] italic text-slate-300">signature appears here</span>
              )}
            </div>

            <div className="mt-1 border-t border-slate-300 pt-1">
              <p className="text-[11px] font-bold text-slate-800">{signatoryName || "—"}</p>
              {designation && <p className="text-[10px] text-slate-500">{designation}</p>}
              <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>

      {!enabled && (
        <p className="mt-2 text-[11px] font-medium text-amber-600">
          Turned off — quotations will print without this block.
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   SECTION
══════════════════════════════════════════════════════════════════════════════════════════════ */
export default function SignatureSection({ showToast, canManage, SectionCard, companyName }) {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  /* Same meaning as in GoogleReviewsTab: the endpoints are not deployed. Distinct from any real
     error, and never surfaced as a toast — until the backend ships this is the expected state and
     an error on every visit teaches people to ignore errors. */
  const [unavailable, setUnavailable] = useState(false);

  const [mode, setMode] = useState("draw");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [opaqueWarning, setOpaqueWarning] = useState(null);
  const [padDirty, setPadDirty] = useState(false);
  const [armedDelete, setArmedDelete] = useState(null);
  const [sealBusy, setSealBusy] = useState(false);

  const padRef = useRef(null);
  const fileRef = useRef(null);
  const sealRef = useRef(null);
  /* Object URLs are revoked explicitly. Left alone they hold the file in memory for the life of
     the document, and this component can churn through several previews in a session. */
  const previewUrlRef = useRef(null);

  const applyState = useCallback((next) => {
    const merged = { ...EMPTY, ...(next || {}) };
    setState(merged);
    setName(merged.signatoryName || "");
    setDesignation(merged.signatoryDesignation || "");
    setEnabled(merged.signatureEnabled !== false);
  }, []);

  /* Load. Started from a microtask rather than run in the effect body: these are state writes, and
     a synchronous setState inside an effect is the cascading render this repo lints against
     (react-hooks/set-state-in-effect). `alive` guards the writes, not merely the start — the tab
     unmounts whenever another one is selected. */
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(async () => {
      if (!alive) return;
      try {
        const data = unwrap(await signatureService.get());
        if (!alive) return;
        applyState(data);
        setUnavailable(false);
      } catch (err) {
        if (!alive) return;
        const httpStatus = err?.response?.status;
        if (httpStatus === 404 || httpStatus === 501) {
          setUnavailable(true);
        } else {
          showToast(getErrorMessage(err, "Couldn't load the signature."), "error");
        }
      } finally {
        if (alive) setLoading(false);
      }
    });
    return () => { alive = false; };
  }, [applyState, showToast]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const setPreviewUrl = (url) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setUploadPreview(url);
  };

  /* Upload picker. Mirrors handleFile in EditProfileTab — same 2MB cap, same toast — so the two
     upload surfaces on this page behave identically. */
  const handlePick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > SIGNATURE_MAX_BYTES) {
      showToast("Max file size is 2MB", "error");
      event.target.value = "";
      return;
    }

    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    const { opaque, white } = await looksOpaque(file);
    setOpaqueWarning(opaque ? (white ? "white" : "opaque") : null);
    // Cleared so re-picking the same file fires change again.
    event.target.value = "";
  };

  const currentBlob = async () => {
    if (mode === "upload") return uploadFile;
    const blob = await padRef.current?.exportBlob();
    if (!blob) {
      showToast("Draw a signature first — the pad is empty.", "error");
      return null;
    }
    // Named for the server's benefit; the extension is what most multipart parsers sniff.
    return new File([blob], "signature.png", { type: "image/png" });
  };

  const handleSave = async () => {
    const file = await currentBlob();
    if (!file) {
      if (mode === "upload") showToast("Choose an image first.", "error");
      return;
    }
    setSaving(true);
    try {
      const data = unwrap(await signatureService.upload(file, name, designation));
      applyState(data);
      padRef.current?.clear();
      setPadDirty(false);
      setUploadFile(null);
      setPreviewUrl(null);
      setOpaqueWarning(null);
      showToast("Signature saved.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't save the signature."), "error");
    } finally {
      setSaving(false);
    }
  };

  /* Metadata only. Separate from the image save so fixing a typo in the name does not require
     re-drawing a signature that was already correct. */
  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      const data = unwrap(await signatureService.updateMeta({
        signatoryName: name,
        signatoryDesignation: designation,
        signatureEnabled: enabled,
      }));
      applyState(data);
      showToast("Signatory details updated.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't update the details."), "error");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSeal = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > SIGNATURE_MAX_BYTES) {
      showToast("Max file size is 2MB", "error");
      return;
    }
    setSealBusy(true);
    try {
      applyState(unwrap(await signatureService.uploadSeal(file)));
      showToast("Seal uploaded.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't upload the seal."), "error");
    } finally {
      setSealBusy(false);
    }
  };

  /* Two-step arm/confirm rather than a modal — the pattern the tax-rate rows on this page already
     use, and it keeps the destructive action in the place the user is looking. */
  const handleDelete = async (what) => {
    if (armedDelete !== what) {
      setArmedDelete(what);
      window.setTimeout(() => setArmedDelete((cur) => (cur === what ? null : cur)), 4000);
      return;
    }
    setArmedDelete(null);
    try {
      const data = what === "seal"
        ? unwrap(await signatureService.removeSeal())
        : unwrap(await signatureService.remove());
      applyState(data);
      showToast(what === "seal" ? "Seal removed." : "Signature removed.");
    } catch (err) {
      showToast(getErrorMessage(err, "Couldn't remove it."), "error");
    }
  };

  if (loading) {
    return (
      <SectionCard title="Authorised Signature" icon={<FiSignature className="h-4 w-4" />}>
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <FiLoader className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </SectionCard>
    );
  }

  const metaDirty =
    name !== (state.signatoryName || "")
    || designation !== (state.signatoryDesignation || "")
    || enabled !== (state.signatureEnabled !== false);

  const previewSrc = mode === "upload" && uploadPreview ? uploadPreview : state.signatureUrl;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Authorised Signature"
        icon={<FiSignature className="h-4 w-4" />}
        subtitle="Captured once here, then printed on your quotations"
      >
        {unavailable && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
              <FiAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Not available on this server yet
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
              The signature endpoints aren’t deployed. This screen is ready and will start working
              as soon as they are — nothing here needs changing.
            </p>
          </div>
        )}

        {/* Two modes, and deliberately no third. A "type your name in a script font" option exists
            in plenty of tools and it reads as exactly what it is — a font, not a signature — which
            undermines the document it appears on. */}
        <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { id: "draw", label: "Draw", Icon: FiPen },
            { id: "upload", label: "Upload", Icon: FiUpload },
          ].map(({ id, label, Icon }) => (
            <button
              key={id} type="button" onClick={() => setMode(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <SignaturePad ref={padRef} disabled={!canManage} onDirtyChange={setPadDirty} />
        ) : (
          <div>
            <input
              ref={fileRef} type="file" accept={SIGNATURE_ACCEPT}
              onChange={handlePick} className="hidden"
            />
            <button
              type="button" onClick={() => fileRef.current?.click()} disabled={!canManage}
              className="flex w-full max-w-[640px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 transition hover:border-blue-400 disabled:opacity-50"
              style={{ minHeight: 140 }}
            >
              {uploadPreview ? (
                <img src={uploadPreview} alt="Signature preview" className="max-h-24 object-contain" />
              ) : (
                <>
                  <FiUpload className="h-6 w-6 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-500">Choose a PNG or JPG</span>
                  <span className="text-[10px] text-slate-400">Max 2MB · a transparent PNG gives the best result</span>
                </>
              )}
            </button>

            {/* Warns, never blocks — a scan on white paper is the commonest thing uploaded here and
                refusing it outright would just send the user away. */}
            {opaqueWarning && (
              <div className="mt-2 max-w-[640px] rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
                  <FiAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {opaqueWarning === "white"
                    ? "This image has a solid white background"
                    : "This image has no transparency"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  It will print as a filled box covering the layout behind it. Check the preview
                  below — if that looks wrong, draw the signature instead, or remove the background
                  and re-upload as a transparent PNG.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Name and designation. The image alone is meaningless on a document — an unlabelled mark
            beside "Authorised Signatory" tells the reader nothing about who authorised it. */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 md:max-w-[640px]">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
              Signatory Name
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage}
              placeholder="e.g. Rajesh Kumar"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
              Designation
            </label>
            <input
              value={designation} onChange={(e) => setDesignation(e.target.value)} disabled={!canManage}
              placeholder="e.g. Managing Director"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Labelled by its EFFECT, not as a bare "Enabled". Nothing on this screen reads the flag —
            only the PDF pipeline does — so a generic label would be a switch whose consequence the
            user cannot see anywhere. */}
        <label className={`mt-4 flex w-fit items-start gap-2.5 text-sm font-semibold text-slate-700 ${canManage ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          <input
            type="checkbox" checked={enabled} disabled={!canManage}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Include on quotations
            <span className="block text-[11px] font-normal text-slate-400">
              Turn off to keep the signature on file without printing it
            </span>
          </span>
        </label>

        {canManage && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button" onClick={handleSave}
              disabled={saving || (mode === "draw" ? !padDirty : !uploadFile)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
              {state.hasSignature ? "Replace signature" : "Save signature"}
            </button>

            {/* Metadata save appears only when the text actually differs from what is stored —
                otherwise it is a button that does nothing, sitting next to one that does. */}
            {state.hasSignature && metaDirty && (
              <button
                type="button" onClick={handleSaveMeta} disabled={savingMeta}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {savingMeta ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
                Save name only
              </button>
            )}

            {state.hasSignature && (
              <button
                type="button" onClick={() => handleDelete("signature")}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  armedDelete === "signature"
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500"
                }`}
              >
                {armedDelete === "signature" ? <FiCheck className="h-4 w-4" /> : <FiTrash className="h-4 w-4" />}
                {armedDelete === "signature" ? "Tap again to confirm" : "Delete"}
              </button>
            )}
          </div>
        )}

        {/* An unsaved drawing is lost when the tab unmounts, and the tab unmounts on any tab click.
            Said out loud rather than persisted — there is nowhere safe to persist it to. */}
        {padDirty && mode === "draw" && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
            <FiAlert className="h-3 w-3" /> Not saved yet — leaving this tab will clear the pad.
          </p>
        )}

        {!canManage && (
          <p className="mt-4 text-[11px] text-slate-400">
            Only a user with Settings Manage permission can change the signature.
          </p>
        )}
      </SectionCard>

      <QuotationPreview
        companyName={companyName}
        signatureUrl={previewSrc}
        sealUrl={state.sealUrl}
        signatoryName={name}
        designation={designation}
        enabled={enabled}
      />

      {/* Secondary and clearly optional — most quotations carry a signature and no stamp. */}
      <SectionCard
        title="Company Seal"
        icon={<FiStamp className="h-4 w-4" />}
        subtitle="Optional — a rubber stamp printed beside the signature"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white">
            {state.sealUrl
              ? <img src={state.sealUrl} alt="Company seal" className="max-h-20 max-w-20 object-contain" />
              : <FiStamp className="h-7 w-7 text-slate-200" />}
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={sealRef} type="file" accept={SIGNATURE_ACCEPT} onChange={handleSeal} className="hidden" />
              <button
                type="button" onClick={() => sealRef.current?.click()} disabled={sealBusy}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60"
              >
                {sealBusy ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiUpload className="h-3.5 w-3.5" />}
                {state.sealUrl ? "Replace seal" : "Upload seal"}
              </button>
              {state.sealUrl && (
                <button
                  type="button" onClick={() => handleDelete("seal")}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                    armedDelete === "seal"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500"
                  }`}
                >
                  {armedDelete === "seal" ? <FiCheck className="h-3.5 w-3.5" /> : <FiX className="h-3.5 w-3.5" />}
                  {armedDelete === "seal" ? "Tap again to confirm" : "Remove"}
                </button>
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
