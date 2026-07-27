
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Map as FiMap,
  MapPin as FiMapPin,
  Moon as FiMoon,
  Plus as FiPlus,
  Route as MdRoute,
  Trash2 as FiTrash2,
} from "lucide-react";

import { geographyService } from "@shared/api/geographyService";
import QuickDestinationModal from "../../masters/components/QuickDestinationModal";
import QuickCityModal from "../../masters/components/QuickCityModal";

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

const destinationIdOf = (destination) =>
  destination?.id ??
  destination?.destinationId ??
  destination?.publicId ??
  null;

const cityIdOf = (city) =>
  city?.cityId ?? city?.id ?? city?.publicId ?? null;

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const upsertByIdOrName = (list, item, idGetter) => {
  const itemId = idGetter(item);
  const itemName = normalizeText(item?.name);

  const existingIndex = list.findIndex((current) => {
    const currentId = idGetter(current);

    return (
      (itemId != null && String(currentId) === String(itemId)) ||
      (itemName && normalizeText(current?.name) === itemName)
    );
  });

  if (existingIndex === -1) return [...list, item];

  return list.map((current, index) =>
    index === existingIndex ? { ...current, ...item } : current
  );
};

export default function ItinerarySection({
  hydrationKey,
  itinerary,
  onAdd,
  onRemove,
  onUpdate,
}) {
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [destinationLoadError, setDestinationLoadError] = useState("");

  // { [rowId]: { destinationId, destination, cityId, cities, loadingCity } }
  const [rowGeo, setRowGeoState] = useState({});

  const initialHydrationDoneRef = useRef(false);

  const [destinationModalRowId, setDestinationModalRowId] = useState(null);
  const [cityModalRowId, setCityModalRowId] = useState(null);
  const [notice, setNotice] = useState(null);

  const setRowGeo = useCallback((rowId, patch) => {
    setRowGeoState((previous) => ({
      ...previous,
      [rowId]: {
        ...previous[rowId],
        ...patch,
      },
    }));
  }, []);

  const showNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });

    window.setTimeout(() => {
      setNotice((current) =>
        current?.message === message ? null : current
      );
    }, 4000);
  }, []);

  const loadDestinations = useCallback(async () => {
    setLoadingDestinations(true);
    setDestinationLoadError("");

    try {
      const response = await geographyService.getAllDestinations();
      const list = extractArray(response);

      setDestinations(list);
      return list;
    } catch (error) {
      console.error("Load destinations failed:", error);

      setDestinations([]);
      setDestinationLoadError(
        getApiErrorMessage(error, "Could not load destinations.")
      );
      return [];
    } finally {
      setLoadingDestinations(false);
    }
  }, []);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  useEffect(() => {
    initialHydrationDoneRef.current = false;
    setRowGeoState({});
  }, [hydrationKey]);

  useEffect(() => {
    /*
     * Edit page opens initially with itinerary names:
     *
     * {
     *   destination: "Kathmandu",
     *   city: "Kathmandu",
     *   nights: 2
     * }
     *
     * But dropdowns need destinationId and cityId.
     * This effect converts saved names/IDs into dropdown IDs.
     */

    if (initialHydrationDoneRef.current) return;
    if (loadingDestinations) return;
    if (destinations.length === 0) return;

    const savedRows = itinerary.filter(
      (row) =>
        row.destinationId ||
        normalizeText(row.destination)
    );

    // Create Lead blank row: nothing to hydrate yet.
    if (savedRows.length === 0) return;

    let cancelled = false;

    const hydrateSavedItinerary = async () => {
      const hydratedRows = {};

      for (const row of savedRows) {
        const savedDestinationId =
          row.destinationId ??
          row.destination?.id ??
          row.destination?.publicId ??
          "";

        const savedDestinationName = normalizeText(
          typeof row.destination === "string"
            ? row.destination
            : row.destination?.name
        );

        const destination = destinations.find((item) => {
          const itemId = destinationIdOf(item);

          const matchesId =
            savedDestinationId &&
            String(itemId) === String(savedDestinationId);

          const matchesName =
            savedDestinationName &&
            normalizeText(item?.name) === savedDestinationName;

          return matchesId || matchesName;
        });

        if (!destination) {
          console.warn(
            "Saved itinerary destination not found in master:",
            row.destination
          );

          hydratedRows[row.id] = {
            destinationId: "",
            destination: null,
            cityId: "",
            cities: [],
            loadingCity: false,
          };

          continue;
        }

        const destinationId = destinationIdOf(destination);

        let cities = [];

        try {
          const response =
            await geographyService.getCitiesByDestination(
              destinationId
            );

          cities = extractArray(response);
        } catch (error) {
          console.error(
            `Could not load cities for ${destination?.name}:`,
            error
          );
        }

        if (cancelled) return;

        const savedCityId =
          row.cityId ??
          row.city?.id ??
          row.city?.publicId ??
          "";

        const savedCityName = normalizeText(
          typeof row.city === "string"
            ? row.city
            : row.city?.name
        );

        const selectedCity = cities.find((city) => {
          const currentCityId = cityIdOf(city);

          const matchesId =
            savedCityId &&
            String(currentCityId) === String(savedCityId);

          const matchesName =
            savedCityName &&
            normalizeText(city?.name) === savedCityName;

          return matchesId || matchesName;
        });

        hydratedRows[row.id] = {
          destinationId:
            destinationId != null
              ? String(destinationId)
              : "",

          destination,

          cityId: selectedCity
            ? String(cityIdOf(selectedCity) ?? "")
            : "",

          cities,
          loadingCity: false,
        };
      }

      if (cancelled) return;

      setRowGeoState((previous) => ({
        ...previous,
        ...hydratedRows,
      }));

      initialHydrationDoneRef.current = true;
    };

    hydrateSavedItinerary();

    return () => {
      cancelled = true;
    };
  }, [
    destinations,
    itinerary,
    loadingDestinations,
  ]);

  useEffect(() => {
    const activeRowIds = new Set(itinerary.map((row) => String(row.id)));

    setRowGeoState((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([rowId]) =>
          activeRowIds.has(String(rowId))
        )
      )
    );
  }, [itinerary]);

  const loadCitiesForRow = useCallback(
    async (rowId, destinationId) => {
      if (!destinationId) {
        setRowGeo(rowId, {
          cityId: "",
          cities: [],
          loadingCity: false,
        });
        return [];
      }

      setRowGeo(rowId, {
        cities: [],
        cityId: "",
        loadingCity: true,
      });

      try {
        const response =
          await geographyService.getCitiesByDestination(destinationId);
        const cities = extractArray(response);

        setRowGeo(rowId, {
          cities,
          loadingCity: false,
        });

        return cities;
      } catch (error) {
        console.error("Load cities failed:", error);

        setRowGeo(rowId, {
          cities: [],
          cityId: "",
          loadingCity: false,
        });
        showNotice(
          getApiErrorMessage(error, "Could not load cities."),
          "error"
        );
        return [];
      }
    },
    [setRowGeo, showNotice]
  );

  const selectDestination = useCallback(
    async (rowId, destination) => {
      const destinationId = destinationIdOf(destination);

      onUpdate(rowId, "destination", destination?.name || "");
      onUpdate(rowId, "city", "");

      setRowGeo(rowId, {
        destinationId: destinationId != null ? String(destinationId) : "",
        destination,
        cityId: "",
        cities: [],
        loadingCity: Boolean(destinationId),
      });

      if (destinationId != null) {
        await loadCitiesForRow(rowId, destinationId);
      }
    },
    [loadCitiesForRow, onUpdate, setRowGeo]
  );

  const handleDestinationChange = async (rowId, destinationId) => {
    if (!destinationId) {
      onUpdate(rowId, "destination", "");
      onUpdate(rowId, "city", "");
      setRowGeo(rowId, {
        destinationId: "",
        destination: null,
        cityId: "",
        cities: [],
        loadingCity: false,
      });
      return;
    }

    const destination = destinations.find(
      (item) => String(destinationIdOf(item)) === String(destinationId)
    );

    if (!destination) {
      showNotice("Selected destination was not found. Refresh the list.", "error");
      return;
    }

    await selectDestination(rowId, destination);
  };

  const handleCityChange = (rowId, cityId) => {
    const city = rowGeo[rowId]?.cities?.find(
      (item) => String(cityIdOf(item)) === String(cityId)
    );

    setRowGeo(rowId, {
      cityId: cityId ? String(cityId) : "",
    });
    onUpdate(rowId, "city", city?.name || "");
  };

  const handleDestinationCreated = async (savedDestination) => {
    const rowId = destinationModalRowId;
    if (rowId == null) return;

    setDestinations((previous) =>
      upsertByIdOrName(previous, savedDestination, destinationIdOf)
    );

    setDestinationModalRowId(null);
    await selectDestination(rowId, savedDestination);

    showNotice(
      `Destination “${savedDestination.name}” created and selected.`
    );

    window.dispatchEvent(
      new CustomEvent("travelcrm:destination-created", {
        detail: savedDestination,
      })
    );
  };

  const handleCityCreated = async (savedCity) => {
    const rowId = cityModalRowId;
    if (rowId == null) return;

    const savedCityId = cityIdOf(savedCity);

    setRowGeoState((previous) => {
      const current = previous[rowId] || {};
      const nextCities = upsertByIdOrName(
        current.cities || [],
        savedCity,
        cityIdOf
      );

      return {
        ...previous,
        [rowId]: {
          ...current,
          cities: nextCities,
          cityId: savedCityId != null ? String(savedCityId) : "",
          loadingCity: false,
        },
      };
    });

    onUpdate(rowId, "city", savedCity.name || "");
    setCityModalRowId(null);

    showNotice(`City “${savedCity.name}” created and selected.`);

    window.dispatchEvent(
      new CustomEvent("travelcrm:city-created", {
        detail: savedCity,
      })
    );
  };

  const selectedCityDestination = useMemo(() => {
    if (cityModalRowId == null) return null;

    const geo = rowGeo[cityModalRowId] || {};

    return (
      geo.destination ||
      destinations.find(
        (destination) =>
          String(destinationIdOf(destination)) === String(geo.destinationId)
      ) ||
      null
    );
  }, [cityModalRowId, destinations, rowGeo]);

  const chevron = (
    <svg
      className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
              <MdRoute className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-white">
                Travel Itinerary
              </h2>
              <p className="truncate text-xs text-indigo-100">
                Add destinations, cities and nights for each stop
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white">
            {itinerary.length} Stop{itinerary.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-6">
          {notice && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs font-semibold ${notice.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
            >
              {notice.type === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
          )}

          {destinationLoadError && (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs font-semibold text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{destinationLoadError}</span>
              </div>
              <button
                type="button"
                onClick={loadDestinations}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          )}

          {itinerary.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <MdRoute className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">No destinations added yet</p>
              <p className="mt-1 text-xs">
                Click “Add Itinerary Stop” to start building the itinerary
              </p>
            </div>
          )}

          {itinerary.map((row, index) => {
            const geo = rowGeo[row.id] || {};
            const hasDestination = Boolean(geo.destinationId);

            return (
              <div
                key={row.id}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/30 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {index + 1}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Destination {index + 1}
                    </span>
                  </div>

                  {itinerary.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-400 transition-all hover:bg-red-100 hover:text-red-600"
                      title="Remove itinerary stop"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <FiMap className="h-3 w-3 text-indigo-400" />
                        Destination
                      </label>
                      <button
                        type="button"
                        onClick={() => setDestinationModalRowId(row.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                      >
                        <FiPlus className="h-3 w-3" />
                        Add
                      </button>
                    </div>

                    <div className="relative">
                      <select
                        value={geo.destinationId || ""}
                        onChange={(event) =>
                          handleDestinationChange(row.id, event.target.value)
                        }
                        disabled={loadingDestinations}
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-7 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 disabled:opacity-60"
                      >
                        <option value="">
                          {loadingDestinations
                            ? "Loading…"
                            : destinations.length === 0
                              ? "No destinations"
                              : "Select destination"}
                        </option>
                        {destinations.map((destination) => {
                          const destinationId = destinationIdOf(destination);

                          return (
                            <option
                              key={destinationId ?? destination.name}
                              value={destinationId ?? ""}
                            >
                              {destination.name}
                            </option>
                          );
                        })}
                      </select>
                      {chevron}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <FiMapPin className="h-3 w-3 text-indigo-400" />
                        City
                      </label>
                      <button
                        type="button"
                        disabled={!hasDestination}
                        onClick={() => setCityModalRowId(row.id)}
                        title={
                          hasDestination
                            ? "Add city under selected destination"
                            : "Select destination first"
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        <FiPlus className="h-3 w-3" />
                        Add
                      </button>
                    </div>

                    <div className="relative">
                      <select
                        value={geo.cityId || ""}
                        onChange={(event) =>
                          handleCityChange(row.id, event.target.value)
                        }
                        disabled={!hasDestination || geo.loadingCity}
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-7 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 disabled:opacity-60"
                      >
                        <option value="">
                          {!hasDestination
                            ? "Select destination first"
                            : geo.loadingCity
                              ? "Loading…"
                              : (geo.cities || []).length === 0
                                ? "No cities"
                                : "Select city"}
                        </option>
                        {(geo.cities || []).map((city) => {
                          const cityId = cityIdOf(city);

                          return (
                            <option key={cityId ?? city.name} value={cityId ?? ""}>
                              {city.name}
                            </option>
                          );
                        })}
                      </select>
                      {chevron}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <FiMoon className="h-3 w-3 text-indigo-400" />
                      Nights
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(
                            row.id,
                            "nights",
                            Math.max(1, (row.nights || 1) - 1)
                          )
                        }
                        className="h-9 w-9 rounded-lg bg-slate-200 text-sm font-bold text-slate-600 transition-all hover:bg-indigo-200"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={row.nights || 1}
                        onChange={(event) =>
                          onUpdate(
                            row.id,
                            "nights",
                            Math.max(
                              1,
                              Math.min(
                                30,
                                Number.parseInt(event.target.value, 10) || 1
                              )
                            )
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(
                            row.id,
                            "nights",
                            Math.min(30, (row.nights || 1) + 1)
                          )
                        }
                        className="h-9 w-9 rounded-lg bg-slate-200 text-sm font-bold text-slate-600 transition-all hover:bg-indigo-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {itinerary.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-slate-600">
                Total Duration
              </span>
              <span className="text-sm font-bold text-indigo-700">
                {itinerary.reduce(
                  (sum, row) => sum + (row.nights || 1),
                  0
                )}{" "}
                Nights /{" "}
                {itinerary.reduce(
                  (sum, row) => sum + (row.nights || 1),
                  0
                ) + 1}{" "}
                Days
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onAdd}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 py-2.5 text-sm font-semibold text-indigo-600 transition-all hover:border-indigo-400 hover:bg-indigo-50"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 transition group-hover:bg-indigo-200">
              <FiPlus className="h-3.5 w-3.5" />
            </div>
            Add Itinerary Stop
          </button>
        </div>
      </div>

      <QuickDestinationModal
        open={destinationModalRowId != null}
        onClose={() => setDestinationModalRowId(null)}
        onCreated={handleDestinationCreated}
        defaultCountryName="India"
      />

      <QuickCityModal
        open={cityModalRowId != null}
        onClose={() => setCityModalRowId(null)}
        onCreated={handleCityCreated}
        destination={selectedCityDestination}
      />
    </>
  );
}