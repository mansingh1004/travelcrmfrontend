// src/console/pages/hotelmarketplace360/TabPhotos.jsx
//
// The property gallery, and the first place an operator has ever been able to manage it.
//
// Until now `platform_hotel_images` had NO write path at all: photographs could only arrive from
// V16's backfill, the seed script, or a hotel-partner promotion. An operator could see the gallery
// on the tenant-facing page and could not add to it, remove from it, or choose which shot
// represented the property.
//
// WHAT IT IS NOT: the room galleries. Those live on `platform_hotel_room_images`, are edited per
// room in the hotel editor, and must never be mixed in here — a lobby shot standing in for a room
// misrepresents that room to an agent's own customer, and nobody downstream ever learns it did.
//
// STEP-UP ON EVERY WRITE. A gallery change bumps catalogVersion, which re-syncs into every tenant's
// copy of this hotel. That is the same blast radius as a rate change and it carries the same
// confirmation, through the same `useStepUp` flow the room and rate editors use.
//
// STYLING: console realm. Semantic utilities only — raw slate-*/blue-* resolve to the TENANT palette.

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, Plus, Star, Trash2, Upload } from "lucide-react";
import { platformHotelService } from "../../api/platformHotelService";
import { useStepUp } from "../../components/useStepUp";
import { Button, GlassCard, Input, Select } from "../../components/hotelUi";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

/** Mirrors HotelImageCategory. A value the backend gains before this list does still renders. */
const CATEGORIES = [
  "GENERAL", "EXTERIOR", "FACADE", "LOBBY", "DINING",
  "POOL", "SPA", "WELLNESS", "ROOM", "AMENITY", "VIEW",
];

const human = (v) => {
  const s = String(v ?? "").replace(/_/g, " ").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

export default function TabPhotos({ publicId, onChanged }) {
  const { showToast } = useToast();
  const stepUp = useStepUp();
  const fileRef = useRef(null);

  const [images, setImages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  /*
    The gallery is read off the hotel, not a dedicated endpoint. `PlatformHotelAdminDto.images` is
    populated on the detail response and null on list rows — so this refetch is the same call the
    Overview tab makes, and there is no second shape to keep in step.
  */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hotel = await platformHotelService.get(publicId);
      setImages(hotel?.images ?? []);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not load photos."), "error");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  const after = async () => { await load(); onChanged?.(); };

  /** Upload puts the bytes on the CDN and returns a URL; attaching it is a separate, step-upped call. */
  const pickFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { imagePath } = await platformHotelService.uploadImage(file);
      attach(imagePath);
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not upload that photo."), "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const attach = (imageUrl) => stepUp.request({
    title: "Confirm new photo",
    description: "Photos are part of the catalogue entry, so this re-syncs to every tenant's copy.",
    confirmLabel: "Add photo",
    run: async (mfaCode) => {
      await platformHotelService.addImage(publicId, { imageUrl }, mfaCode);
      setUrlDraft("");
      await after();
      showToast("Photo added.", "success");
    },
  });

  const patch = (image, payload, verb) => stepUp.request({
    title: `Confirm ${verb}`,
    description: "Photos are part of the catalogue entry, so this re-syncs to every tenant's copy.",
    confirmLabel: "Save",
    run: async (mfaCode) => {
      await platformHotelService.updateImage(publicId, image.publicId, payload, mfaCode);
      await after();
    },
  });

  const remove = (image) => stepUp.request({
    title: "Confirm photo removal",
    description: "This removes the photo from the catalogue entry for every tenant.",
    confirmLabel: "Remove photo",
    run: async (mfaCode) => {
      await platformHotelService.deleteImage(publicId, image.publicId, mfaCode);
      await after();
      showToast("Photo removed.", "success");
    },
  });

  const busy = stepUp.busy || uploading;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <GlassCard className="p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-heading">Property photos</h2>
            <p className="mt-0.5 text-xs text-muted">
              Shown on every tenant&apos;s catalogue page. Room photos are edited per room, in the hotel editor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Paste-a-URL beside the picker, because an operator working from a supplier's media
                pack usually already has a link and should not have to download it first. */}
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlDraft.trim()) { e.preventDefault(); attach(urlDraft.trim()); }
              }}
              placeholder="Paste an image URL…"
              className="w-64"
              disabled={busy}
            />
            <Button
              variant="outline"
              disabled={busy || !urlDraft.trim()}
              onClick={() => attach(urlDraft.trim())}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-surface-hover motion-reduce:animate-none" />
            ))}
          </div>
        ) : images.length === 0 ? (
          /* An honest empty state. A property with no photographs is a real state — most hotels the
             SuperAdmin created by hand have never had one — and it is fixed from this screen. */
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <ImageOff className="mx-auto mb-2 h-6 w-6 text-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-heading">No photos yet</p>
            <p className="mt-1 text-xs text-muted">
              Upload one, or paste a URL. The first photo becomes the cover automatically.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {images.map((img) => (
              <li key={img.publicId} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="relative">
                  <img
                    src={img.url}
                    alt={img.caption || "Property photo"}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {img.primary && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-text">
                      <Star className="h-3 w-3 fill-current" /> Cover
                    </span>
                  )}
                </div>

                <div className="space-y-2 p-2.5">
                  <Input
                    defaultValue={img.caption ?? ""}
                    placeholder="Caption"
                    disabled={busy}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== (img.caption ?? "")) patch(img, { caption: next }, "caption");
                    }}
                  />
                  <Select
                    value={img.category ?? "GENERAL"}
                    disabled={busy}
                    onChange={(e) => patch(img, { category: e.target.value }, "category")}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{human(c)}</option>)}
                  </Select>

                  <div className="flex items-center justify-between gap-2">
                    {/* Promote only. There is no "un-cover" button because a property with photos and
                        no cover shows a blank card everywhere — the cover moves, it never vacates. */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || img.primary}
                      onClick={() => patch(img, { primary: true }, "cover")}
                    >
                      <Star className="h-3.5 w-3.5" />
                      {img.primary ? "Cover" : "Make cover"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => remove(img)}
                      aria-label="Remove photo"
                      title="Remove photo"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-hue-rose" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {stepUp.dialog}
    </div>
  );
}
