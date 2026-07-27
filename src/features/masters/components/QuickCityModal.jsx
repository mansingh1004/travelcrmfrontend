import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Globe,
  Loader2,
  MapPin,
  X,
} from "lucide-react";

import { cityService } from "../api/CityService";
import { geographyService } from "@shared/api/geographyService";

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const destinationIdOf = (destination) =>
  destination?.id ??
  destination?.destinationId ??
  destination?.publicId ??
  null;

const cityIdOf = (city) =>
  city?.cityId ?? city?.id ?? city?.publicId ?? null;

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
  const candidates = [value?.data?.data, value?.data, value];

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

function FieldError({ message }) {
  if (!message) return null;

  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export default function QuickCityModal({
  open,
  onClose,
  onCreated,
  destination,
}) {
  const bodyRef = useRef(null);

  const [resolvedDestination, setResolvedDestination] = useState(destination);
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const destinationId = destinationIdOf(resolvedDestination || destination);
  const destinationName =
    resolvedDestination?.name ||
    resolvedDestination?.destinationName ||
    destination?.name ||
    destination?.destinationName ||
    "";

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

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setResolvedDestination(destination);
    setCountries([]);
    setCountryId("");
    setName("");
    setCode("");
    setSaving(false);
    setErrors({});

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleEscape);

    const loadInitialData = async () => {
      setCountriesLoading(true);

      try {
        const countryResponse = await geographyService.getCountries();
        const countryList = extractArray(countryResponse);

        let fullDestination = destination;
        const currentDestinationId = destinationIdOf(destination);
        const hasCountryInformation = Boolean(
          destination?.countryId ||
            destination?.country?.id ||
            destination?.countryName ||
            destination?.country
        );

        if (
          !hasCountryInformation &&
          currentDestinationId &&
          typeof geographyService.getDestinationById === "function"
        ) {
          try {
            const destinationResponse =
              await geographyService.getDestinationById(currentDestinationId);
            const fetchedDestination = extractObject(destinationResponse);

            if (Object.keys(fetchedDestination).length > 0) {
              fullDestination = {
                ...destination,
                ...fetchedDestination,
              };
            }
          } catch (error) {
            console.warn("Could not load full destination details:", error);
          }
        }

        if (cancelled) return;

        setResolvedDestination(fullDestination);
        setCountries(countryList);

        const knownCountryId =
          fullDestination?.countryId ??
          fullDestination?.country?.id ??
          fullDestination?.countryPublicId ??
          null;

        const knownCountryName =
          fullDestination?.countryName ||
          (typeof fullDestination?.country === "string"
            ? fullDestination.country
            : fullDestination?.country?.name) ||
          "";

        const matchedCountry = knownCountryId
          ? countryList.find(
              (country) => String(country?.id) === String(knownCountryId)
            )
          : countryList.find(
              (country) =>
                normalizeText(country?.name || country?.countryName) ===
                normalizeText(knownCountryName)
            );

        const indiaFallback = countryList.find(
          (country) =>
            normalizeText(country?.name || country?.countryName) === "india"
        );

        const initialCountry = matchedCountry || indiaFallback;

        if (initialCountry?.id != null) {
          setCountryId(String(initialCountry.id));
        }
      } catch (error) {
        if (cancelled) return;

        setErrors({
          api: getApiErrorMessage(error, "Could not load city form data."),
        });
        scrollToError();
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, destination]);

  if (!open || typeof document === "undefined") return null;

  const closeSafely = () => {
    if (saving) return;
    onClose?.();
  };

  const validate = () => {
    const nextErrors = {};

    if (!countryId) nextErrors.countryId = "Country is required.";
    if (!destinationId)
      nextErrors.destinationId = "Select a destination before adding a city.";
    if (!name.trim()) nextErrors.name = "City name is required.";

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      scrollToError();
      return false;
    }

    return true;
  };

  const fetchSavedCity = async ({ response, cityName }) => {
    const responseObject = extractObject(response);
    const responseId = cityIdOf(responseObject);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await sleep(300 * attempt);

      let cityList = [];

      try {
        const byDestinationResponse =
          await geographyService.getCitiesByDestination(destinationId);
        cityList = extractArray(byDestinationResponse);
      } catch (error) {
        console.warn("Cities-by-destination refresh failed:", error);
      }

      if (cityList.length === 0 && typeof cityService.getAllCities === "function") {
        try {
          const allCitiesResponse = await cityService.getAllCities();
          cityList = extractArray(allCitiesResponse).filter((city) => {
            const cityDestinationId =
              city?.destinationId ??
              city?.destination?.id ??
              city?.destinationPublicId ??
              null;

            const cityDestinationName =
              city?.destinationName ||
              (typeof city?.destination === "string"
                ? city.destination
                : city?.destination?.name) ||
              "";

            return (
              (cityDestinationId != null &&
                String(cityDestinationId) === String(destinationId)) ||
              normalizeText(cityDestinationName) === normalizeText(destinationName)
            );
          });
        } catch (error) {
          console.warn("All-cities fallback refresh failed:", error);
        }
      }

      const byId =
        responseId != null
          ? cityList.find(
              (city) => String(cityIdOf(city)) === String(responseId)
            )
          : null;

      const byName = cityList.find(
        (city) => normalizeText(city?.name) === normalizeText(cityName)
      );

      const found = byId || byName;
      if (found) return found;
    }

    if (responseId != null) {
      const countryName =
        selectedCountry?.name || selectedCountry?.countryName || "";

      return {
        ...responseObject,
        cityId: responseObject.cityId ?? responseId,
        id: responseObject.id ?? responseId,
        name: responseObject.name || name.trim(),
        code: responseObject.code || code.trim().toUpperCase(),
        countryId: responseObject.countryId ?? countryId,
        countryName: responseObject.countryName || countryName,
        destinationId: responseObject.destinationId ?? destinationId,
        destinationName:
          responseObject.destinationName || destinationName,
      };
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setErrors((previous) => ({ ...previous, api: "" }));

    try {
      const response = await cityService.createCity(
        countryId,
        destinationId,
        name.trim(),
        code.trim().toUpperCase()
      );

      const savedCity = await fetchSavedCity({
        response,
        cityName: name.trim(),
      });

      if (!savedCity) {
        throw new Error(
          "The create request finished, but the new city was not found in City Master. Check the POST response and backend transaction."
        );
      }

      await onCreated?.(savedCity);
    } catch (error) {
      console.error("Create city failed:", error);

      setErrors((previous) => ({
        ...previous,
        api: getApiErrorMessage(error, "Failed to create city."),
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
      aria-labelledby="quick-city-title"
    >
      <button
        type="button"
        aria-label="Close city form"
        onClick={closeSafely}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-[3px]"
      />

      <div className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-3xl sm:border sm:border-slate-200">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white sm:h-10 sm:w-10">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="quick-city-title"
                className="truncate text-base font-extrabold text-white sm:text-lg"
              >
                Add New City
              </h2>
              <p className="truncate text-[11px] font-medium text-blue-100 sm:text-xs">
                Saves to the same City Master
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSafely}
            disabled={saving}
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
                  className={`w-full appearance-none rounded-xl border bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${
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
                  <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
                ) : (
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                )}
              </div>
              <FieldError message={errors.countryId} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Destination <span className="text-rose-500">*</span>
              </label>
              <div
                className={`flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3 ${
                  errors.destinationId ? "border-rose-300" : "border-slate-200"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400">
                    Current itinerary destination
                  </p>
                  <p className="truncate text-sm font-bold text-slate-700">
                    {destinationName || "Select a destination first"}
                  </p>
                </div>
              </div>
              <FieldError message={errors.destinationId} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  City Name <span className="text-rose-500">*</span>
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
                  placeholder="e.g. Kathmandu"
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${
                    errors.name ? "border-rose-300" : "border-slate-200"
                  }`}
                />
                <FieldError message={errors.name} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Airport Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 4)
                    )
                  }
                  disabled={saving}
                  placeholder="e.g. KTM"
                  maxLength={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm uppercase text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                />
                <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                  Optional IATA airport code
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs font-medium text-blue-700">
              <Globe className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The modal verifies the new city against the selected
                destination before closing.
              </span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={closeSafely}
              disabled={saving}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:px-5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !destinationId}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
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