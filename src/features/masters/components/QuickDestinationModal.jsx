import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Loader2,
  Map,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  destinationService,
  uploadImageToCloudinary,
} from "../api/DestinationService";
import { geographyService } from "@shared/api/geographyService";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
];

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const destinationIdOf = (destination) =>
  destination?.id ??
  destination?.destinationId ??
  destination?.publicId ??
  null;

const extractArray = (value) => {
  const candidates = [
    value,
    value?.data,
    value?.data?.data,
    value?.content,
    value?.data?.content,
    value?.data?.data?.content,
    value?.data?.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const extractObject = (value) => {
  const candidates = [
    value?.data?.data,
    value?.data,
    value,
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ) ?? {}
  );
};

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.details ||
  error?.message ||
  fallback;

const getUploadedUrl = (result) => {
  if (typeof result === "string") return result;

  return (
    result?.secure_url ||
    result?.secureUrl ||
    result?.url ||
    result?.data?.secure_url ||
    result?.data?.secureUrl ||
    result?.data?.url ||
    result?.data?.data?.secure_url ||
    result?.data?.data?.secureUrl ||
    result?.data?.data?.url ||
    ""
  );
};

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export default function QuickDestinationModal({
  open,
  onClose,
  onCreated,
  defaultCountryName = "India",
}) {
  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);
  const localPreviewUrlRef = useRef("");

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Domestic");

  const [imagePath, setImagePath] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Mirror `saving` / `uploading` for the Escape listener, which is registered once per open and
  // would otherwise close over permanently-false values. See handleEscape below.
  const savingRef = useRef(false);
  const uploadingRef = useRef(false);
  savingRef.current = saving;
  uploadingRef.current = uploading;

  const selectedCountry = useMemo(
    () =>
      countries.find(
        (country) => String(country?.id) === String(countryId)
      ) || null,
    [countries, countryId]
  );

  const scrollToError = () => {
    window.requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const clearLocalPreview = () => {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = "";
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    clearLocalPreview();
    setCountries([]);
    setCountryId("");
    setName("");
    setType("Domestic");
    setImagePath("");
    setImagePreview("");
    setUploadProgress(0);
    setUploading(false);
    setSaving(false);
    setErrors({});

    // OLD — replaced in create-form redesign
    // const handleEscape = (event) => {
    //   if (event.key === "Escape" && !saving && !uploading) {
    //     onClose?.();
    //   }
    // };
    //
    // Deps here are [open, defaultCountryName], so `saving` and `uploading` were frozen false for
    // the life of the dialog and Esc closed it mid-save or mid-upload — the exact action closeSafely
    // refuses from the X button. Refs keep the guard live.
    const handleEscape = (event) => {
      if (event.key === "Escape" && !savingRef.current && !uploadingRef.current) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscape);

    const loadCountries = async () => {
      setCountriesLoading(true);

      try {
        const response = await geographyService.getCountries();
        const list = extractArray(response);

        if (cancelled) return;

        setCountries(list);

        const preferred = list.find(
          (country) =>
            normalizeText(country?.name || country?.countryName) ===
            normalizeText(defaultCountryName || "India")
        );

        if (preferred?.id != null) {
          setCountryId(String(preferred.id));
        }
      } catch (error) {
        if (cancelled) return;

        setErrors({
          api: getApiErrorMessage(error, "Could not load countries."),
        });
        scrollToError();
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    };

    loadCountries();

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      clearLocalPreview();
    };
  }, [open, defaultCountryName]);

  if (!open || typeof document === "undefined") return null;

  const closeSafely = () => {
    if (saving || uploading) return;
    onClose?.();
  };

  const validate = () => {
    const nextErrors = {};

    if (!countryId) nextErrors.countryId = "Country is required.";
    if (!name.trim()) nextErrors.name = "Destination name is required.";
    if (!type) nextErrors.type = "Destination type is required.";
    if (uploading) nextErrors.image = "Wait for image upload to finish.";

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      scrollToError();
      return false;
    }

    return true;
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const isImage =
      file.type.startsWith("image/") ||
      ALLOWED_IMAGE_EXTENSIONS.includes(extension);

    if (!isImage) {
      setErrors((previous) => ({
        ...previous,
        image: "Choose an image file such as JPG, PNG, WEBP, HEIC or HEIF.",
      }));
      scrollToError();
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((previous) => ({
        ...previous,
        image: "Image must be 8MB or smaller.",
      }));
      scrollToError();
      return;
    }

    clearLocalPreview();

    const localUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = localUrl;

    setImagePreview(localUrl);
    setImagePath("");
    setUploadProgress(0);
    setUploading(true);
    setErrors((previous) => ({ ...previous, image: "", api: "" }));

    try {
      const result = await uploadImageToCloudinary(file, setUploadProgress);
      const uploadedUrl = getUploadedUrl(result);

      if (!uploadedUrl) {
        throw new Error("Upload completed but no image URL was returned.");
      }

      setImagePath(uploadedUrl);
      setImagePreview(uploadedUrl);
      clearLocalPreview();
    } catch (error) {
      console.error("Destination image upload failed:", error);

      setImagePath("");
      setErrors((previous) => ({
        ...previous,
        image: getApiErrorMessage(
          error,
          "Image upload failed. Check Cloudinary configuration and try again."
        ),
      }));
      scrollToError();
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    if (uploading) return;

    clearLocalPreview();
    setImagePath("");
    setImagePreview("");
    setUploadProgress(0);
    setErrors((previous) => ({ ...previous, image: "" }));
  };

  const fetchSavedDestination = async ({ response, payload, countryName }) => {
    const responseObject = extractObject(response);
    const responseId = destinationIdOf(responseObject);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await sleep(300 * attempt);

      const listResponse = await destinationService.getAllDestinations({
        page: 0,
        size: 1000,
      });
      const list = extractArray(listResponse);

      const byId =
        responseId != null
          ? list.find(
              (destination) =>
                String(destinationIdOf(destination)) === String(responseId)
            )
          : null;

      const byNameAndCountry = list.find((destination) => {
        const destinationCountry =
          destination?.countryName ||
          (typeof destination?.country === "string"
            ? destination.country
            : destination?.country?.name);

        return (
          normalizeText(destination?.name) === normalizeText(payload.name) &&
          normalizeText(destinationCountry) === normalizeText(countryName)
        );
      });

      const found = byId || byNameAndCountry;
      if (found) return found;
    }

    if (responseId != null) {
      return {
        ...responseObject,
        id: responseObject.id ?? responseId,
        destinationId: responseObject.destinationId ?? responseId,
        name: responseObject.name || payload.name,
        country: responseObject.country || countryName,
        countryName: responseObject.countryName || countryName,
        countryId: responseObject.countryId ?? selectedCountry?.id ?? null,
        type: responseObject.type || payload.type,
        imagePath: responseObject.imagePath || payload.imagePath,
      };
    }

    return null;
  };

  const handleSubmit = async (event) => {
    // OLD — replaced in create-form redesign
    // event.preventDefault();
    //
    // Same portal-bubbling trap as QuickCityModal: this dialog is createPortal'd to document.body
    // but remains a React child of ItinerarySection inside CreateLead's <form>, and React replays
    // events through the React tree. Without stopPropagation, creating a destination mid-entry also
    // fired the lead form's submit handler.
    event.preventDefault();
    event.stopPropagation();

    if (!validate()) return;

    const countryName =
      selectedCountry?.name || selectedCountry?.countryName || "";

    const payload = {
      country: countryName,
      name: name.trim(),
      type,
      imagePath: imagePath || "",
    };

    setSaving(true);
    setErrors((previous) => ({ ...previous, api: "" }));

    try {
      const response = await destinationService.createDestination(payload);
      const savedDestination = await fetchSavedDestination({
        response,
        payload,
        countryName,
      });

      if (!savedDestination) {
        throw new Error(
          "The create request finished, but the new destination was not found in Destination Master. Check the POST response and backend transaction."
        );
      }

      await onCreated?.(savedDestination);
    } catch (error) {
      console.error("Create destination failed:", error);

      setErrors((previous) => ({
        ...previous,
        api: getApiErrorMessage(error, "Failed to create destination."),
      }));
      scrollToError();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-stretch justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-destination-title"
    >
      <button
        type="button"
        aria-label="Close destination form"
        onClick={closeSafely}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-[3px]"
      />

      <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-indigo-700 to-violet-600 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white sm:h-10 sm:w-10">
              <Map className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="quick-destination-title"
                className="truncate text-base font-extrabold text-white sm:text-lg"
              >
                Add New Destination
              </h2>
              <p className="truncate text-[11px] font-medium text-indigo-100 sm:text-xs">
                Saves to the same Destination Master
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSafely}
            disabled={saving || uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div
            ref={bodyRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:space-y-5 sm:p-6"
          >
            {errors.api && (
              <div className="sticky top-0 z-20 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold text-rose-700 shadow-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{errors.api}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Country <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={countryId}
                    onChange={(event) => {
                      setCountryId(event.target.value);
                      setErrors((previous) => ({
                        ...previous,
                        countryId: "",
                        api: "",
                      }));
                    }}
                    disabled={countriesLoading || saving}
                    className={`w-full appearance-none rounded-xl border bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${
                      errors.countryId ? "border-rose-300" : "border-slate-200"
                    }`}
                  >
                    <option value="">
                      {countriesLoading ? "Loading countries…" : "Select country"}
                    </option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name || country.countryName}
                      </option>
                    ))}
                  </select>
                  {countriesLoading ? (
                    <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500" />
                  ) : (
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  )}
                </div>
                <FieldError message={errors.countryId} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Destination Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={type}
                    onChange={(event) => {
                      setType(event.target.value);
                      setErrors((previous) => ({ ...previous, type: "" }));
                    }}
                    disabled={saving}
                    className={`w-full appearance-none rounded-xl border bg-white px-3 py-2.5 pr-9 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${
                      errors.type ? "border-rose-300" : "border-slate-200"
                    }`}
                  >
                    <option value="Domestic">Domestic</option>
                    <option value="International">International</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <FieldError message={errors.type} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Destination Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((previous) => ({
                    ...previous,
                    name: "",
                    api: "",
                  }));
                }}
                disabled={saving}
                placeholder="e.g. Kashmir, Goa, Kathmandu Valley"
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${
                  errors.name ? "border-rose-300" : "border-slate-200"
                }`}
              />
              <FieldError message={errors.name} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-700">
                  Destination Cover
                </label>
                <span className="text-[11px] font-medium text-slate-400">
                  Optional · max 8MB
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handleFileChange}
                className="sr-only"
              />

              {imagePreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={imagePreview}
                    alt="Destination preview"
                    className="h-32 w-full object-cover sm:h-48"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/80 to-transparent px-3 pb-3 pt-8">
                    <span className="truncate text-xs font-semibold text-white">
                      {uploading ? `Uploading ${uploadProgress}%` : "Image ready"}
                    </span>
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={uploading || saving}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/90 text-rose-600 transition hover:bg-white disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {uploading && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
                      <div
                        className="h-full bg-indigo-400 transition-all"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, Number(uploadProgress) || 0)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 border-dashed bg-white px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60 sm:flex-col sm:justify-center sm:py-7 sm:text-center ${
                    errors.image ? "border-rose-300" : "border-slate-300"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">
                      Select destination image
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-400">
                      JPG, PNG, WEBP, HEIC or HEIF
                    </p>
                  </div>
                </button>
              )}
              <FieldError message={errors.image} />
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-3 text-xs font-medium text-indigo-700">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The modal verifies the created destination against the same
                Destination Master API before closing.
              </span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={closeSafely}
              disabled={saving || uploading}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:px-5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}