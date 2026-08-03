// src/shared/ui/PdfDownloadLoader.jsx
//
// Full-screen "your PDF is being prepared" overlay, mounted by any page that downloads a
// server-rendered PDF through usePdfDownload(). One component for every document type —
// the heading is derived from `documentType` ("Quotation" → "Preparing your quotation PDF"),
// so invoices/vouchers/receipts reuse it without a copy.
//
// Branding: the tenant's own company name + logo (Settings → Company profile), fetched once
// per session through companyService and cached at module level. If the profile is empty or
// the call fails, it falls back to the product mark ("Travel" navy + "CRM" blue) — the loader
// itself never waits on, or breaks because of, the branding call.
//
// Progress honesty: `progressSupported` decides between a real percentage bar and an
// animated indeterminate bar. No fake numbers, ever.

import { useEffect, useRef, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { companyService } from "@features/settings";

/* Fetched once, shared by every loader instance for the rest of the session. */
let brandCache = null;      // { name: string, logo: string|null }
let brandPromise = null;

async function loadBrand() {
  if (brandCache) return brandCache;
  if (!brandPromise) {
    brandPromise = companyService
      .get()
      .then((res) => {
        const c = res?.data?.data ?? res?.data ?? {};
        brandCache = {
          name: (c.name || "").trim(),
          logo: c.logoUrl || c.logo || null,
        };
        return brandCache;
      })
      .catch(() => {
        // Branding is decoration — cache the miss so we don't re-hit a failing endpoint
        // on every download.
        brandCache = { name: "", logo: null };
        return brandCache;
      });
  }
  return brandPromise;
}

export default function PdfDownloadLoader({
  open = false,
  documentType = "Document",
  message,                    // optional heading override
  progress = 0,
  progressSupported = false,
}) {
  const [brand, setBrand] = useState(brandCache);
  const cardRef = useRef(null);

  // Brand fetch — only once the loader is actually shown.
  useEffect(() => {
    if (!open || brand) return;
    let alive = true;
    loadBrand().then((b) => { if (alive) setBrand(b); });
    return () => { alive = false; };
  }, [open, brand]);

  // Scroll lock + focus while open; Escape must not dismiss (there is nothing to cancel —
  // the request is already in flight).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener("keydown", onKey, true);
    cardRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!open) return null;

  const heading = message || `Preparing your ${String(documentType || "document").toLowerCase()} PDF`;
  const hasCompany = !!brand?.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={heading}
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
    >
      <style>{`
        @keyframes pdlFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pdlPop { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pdlSlide { 0% { transform: translateX(-140%); } 100% { transform: translateX(340%); } }
        @media (prefers-reduced-motion: reduce) {
          .pdl-anim, .pdl-anim *, .pdl-spin, .pdl-bar { animation: none !important; }
        }
      `}</style>

      {/* Dark blue-grey translucent backdrop + light blur. Captures every click so the page
          underneath is inert; no onClick — the loader cannot be dismissed by hand. */}
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[3px]"
        style={{ animation: "pdlFadeIn .2s ease both" }}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        className="pdl-anim relative w-full max-w-[600px] rounded-[20px] bg-white shadow-2xl outline-none overflow-hidden"
        style={{ animation: "pdlPop .28s cubic-bezier(.16,1,.3,1) both" }}
      >
        <div className="relative z-10 px-6 sm:px-10 pt-8 pb-9 text-center">

          {/* ── Branding ── */}
          {brand?.logo ? (
            <img
              src={brand.logo}
              alt={brand.name || "logo"}
              className="mx-auto h-12 w-12 rounded-xl object-contain bg-white ring-1 ring-slate-100 shadow-sm"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white text-lg font-extrabold shadow-md shadow-blue-200">
              {(brand?.name || "T").charAt(0).toUpperCase()}
            </div>
          )}
          <p className="mt-2.5 text-sm font-extrabold tracking-tight">
            {hasCompany ? (
              <span className="text-slate-800">{brand.name}</span>
            ) : (
              <>
                <span className="text-slate-800">Travel</span>
                <span className="text-blue-600">CRM</span>
              </>
            )}
          </p>

          {/* ── Heading ── */}
          <h2 className="mt-5 text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
            {heading}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Please wait while we generate your document
          </p>

          {/* ── Circular loader with PDF icon ── */}
          <div className="relative mx-auto mt-8 h-36 w-36">
            {/* soft glow behind the ring */}
            <div className="absolute inset-3 rounded-full bg-blue-400/25 blur-2xl" aria-hidden="true" />

            {/* static light-blue track */}
            <svg viewBox="0 0 144 144" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="72" cy="72" r="58" fill="none" stroke="#dbeafe" strokeWidth="9" />
            </svg>

            {/* rotating active arc + leading dot */}
            <div
              className="pdl-spin absolute inset-0 animate-spin motion-reduce:animate-none"
              style={{ animationDuration: "1.3s" }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 144 144" className="h-full w-full">
                {/* arc ≈ 35% of the circumference, starting at 12 o'clock */}
                <circle
                  cx="72" cy="72" r="58" fill="none"
                  stroke="#1d4ed8" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray="127.5 236.9"
                  transform="rotate(-90 72 72)"
                />
                {/* dot at the arc's leading edge (-90° + 126° sweep = 36°) */}
                <circle cx="118.9" cy="106.1" r="7" fill="#1d4ed8" />
              </svg>
            </div>

            {/* PDF icon in the middle */}
            <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
              <FileText className="h-9 w-9 text-blue-700" strokeWidth={1.8} />
              <span className="mt-0.5 text-[10px] font-extrabold tracking-widest text-blue-700">PDF</span>
            </div>
          </div>

          {/* ── Status + progress bar ── */}
          <p role="status" aria-live="polite" className="mt-7 text-sm font-bold text-slate-700">
            {progressSupported ? `Downloading… ${progress}%` : "Downloading…"}
          </p>
          <div className="mx-auto mt-3 h-2 w-full max-w-[380px] overflow-hidden rounded-full bg-blue-100">
            {progressSupported ? (
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            ) : (
              <div
                className="pdl-bar h-full w-1/3 rounded-full bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400"
                style={{ animation: "pdlSlide 1.2s ease-in-out infinite" }}
              />
            )}
          </div>

          {/* ── Security note ── */}
          <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Your document is secure and will download shortly.
          </p>
        </div>

        {/* ── Decorative waves pinned to the card's bottom ── */}
        <svg
          viewBox="0 0 600 90"
          preserveAspectRatio="none"
          className="pointer-events-none absolute bottom-0 left-0 h-[72px] w-full"
          aria-hidden="true"
        >
          <path d="M0,58 C120,28 220,84 340,60 C450,38 530,66 600,44 L600,90 L0,90 Z" fill="#3b82f6" opacity="0.10" />
          <path d="M0,74 C140,50 260,92 390,70 C490,54 560,74 600,62 L600,90 L0,90 Z" fill="#2563eb" opacity="0.14" />
        </svg>
      </div>
    </div>
  );
}
