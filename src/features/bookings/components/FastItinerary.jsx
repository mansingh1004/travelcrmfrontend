import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LoaderCircle, MapPinned, Plus, Trash2 } from "lucide-react";

import { geographyService } from "@shared/api/geographyService";

const selectClass = "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const destinationIdOf = (item) => item?.id ?? item?.destinationId ?? item?.publicId ?? "";
const cityIdOf = (item) => item?.id ?? item?.cityId ?? item?.publicId ?? "";

export default function FastItinerary({ hydrationKey, itinerary, onAdd, onRemove, onUpdate }) {
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [destinationError, setDestinationError] = useState("");
  const [rowCities, setRowCities] = useState({});
  const [loadingRows, setLoadingRows] = useState({});
  const destinationRefs = useRef({});
  const previousLengthRef = useRef(itinerary.length);

  useEffect(() => {
    let active = true;
    geographyService.getAllDestinations()
      .then((list) => {
        if (active) setDestinations(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) {
          setDestinations([]);
          setDestinationError("Could not load destination master.");
        }
      })
      .finally(() => {
        if (active) setLoadingDestinations(false);
      });
    return () => { active = false; };
  }, []);

  const loadCities = useCallback(async (rowId, destinationId) => {
    if (!destinationId) {
      setRowCities((current) => ({ ...current, [rowId]: [] }));
      return [];
    }

    setLoadingRows((current) => ({ ...current, [rowId]: true }));
    try {
      const list = await geographyService.getCitiesByDestination(destinationId);
      const cities = Array.isArray(list) ? list : [];
      setRowCities((current) => ({ ...current, [rowId]: cities }));
      return cities;
    } catch {
      setRowCities((current) => ({ ...current, [rowId]: [] }));
      return [];
    } finally {
      setLoadingRows((current) => ({ ...current, [rowId]: false }));
    }
  }, []);

  useEffect(() => {
    if (loadingDestinations || destinations.length === 0) return undefined;
    let active = true;

    const hydrate = async () => {
      for (const row of itinerary) {
        if (!active || rowCities[row.id]) continue;
        const destination = destinations.find((item) =>
          (row.destinationId && String(destinationIdOf(item)) === String(row.destinationId)) ||
          (!row.destinationId && normalize(item.name) === normalize(row.destination))
        );
        if (!destination) continue;
        const destinationId = String(destinationIdOf(destination));
        if (!row.destinationId) onUpdate(row.id, "destinationId", destinationId);
        if (!row.destination) onUpdate(row.id, "destination", destination.name || "");
        const cities = await loadCities(row.id, destinationId);
        if (!active || row.cityId || !row.city) continue;
        const city = cities.find((item) => normalize(item.name) === normalize(row.city));
        if (city) onUpdate(row.id, "cityId", String(cityIdOf(city)));
      }
    };

    hydrate();
    return () => { active = false; };
  }, [destinations, hydrationKey, itinerary, loadCities, loadingDestinations, onUpdate, rowCities]);

  useEffect(() => {
    if (itinerary.length > previousLengthRef.current) {
      const lastRow = itinerary[itinerary.length - 1];
      window.setTimeout(() => destinationRefs.current[lastRow?.id]?.focus(), 0);
    }
    previousLengthRef.current = itinerary.length;
  }, [itinerary]);

  const changeDestination = async (row, id) => {
    const destination = destinations.find((item) => String(destinationIdOf(item)) === String(id));
    onUpdate(row.id, "destinationId", id);
    onUpdate(row.id, "destination", destination?.name || "");
    onUpdate(row.id, "cityId", "");
    onUpdate(row.id, "city", "");
    await loadCities(row.id, id);
  };

  const changeCity = (row, id) => {
    const city = (rowCities[row.id] || []).find((item) => String(cityIdOf(item)) === String(id));
    onUpdate(row.id, "cityId", id);
    onUpdate(row.id, "city", city?.name || "");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <MapPinned className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Travel Itinerary</h2>
            <p className="mt-0.5 text-xs text-slate-500">Destination, city and nights in compact rows</p>
          </div>
        </div>
        <button type="button" onClick={onAdd} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
          <Plus className="h-3.5 w-3.5" /> Add Stop
        </button>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-2 hidden grid-cols-[38px_minmax(0,1fr)_minmax(0,1fr)_110px_38px] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
          <span>#</span><span>Destination</span><span>City</span><span>Nights</span><span />
        </div>

        <div className="space-y-2.5">
          {itinerary.map((row, index) => {
            const cities = rowCities[row.id] || [];
            const selectedDestination = destinations.find((item) =>
              (row.destinationId && String(destinationIdOf(item)) === String(row.destinationId)) ||
              normalize(item.name) === normalize(row.destination)
            );
            const destinationValue = selectedDestination ? String(destinationIdOf(selectedDestination)) : row.destination ? "__saved__" : "";
            const selectedCity = cities.find((item) =>
              (row.cityId && String(cityIdOf(item)) === String(row.cityId)) || normalize(item.name) === normalize(row.city)
            );
            const cityValue = selectedCity ? String(cityIdOf(selectedCity)) : row.city ? "__saved__" : "";

            return (
              <div key={row.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[38px_minmax(0,1fr)_minmax(0,1fr)_110px_38px] md:items-center md:border-0 md:bg-transparent md:p-0">
                <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:flex">{index + 1}</span>

                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Destination</span>
                  <div className="relative">
                    <select ref={(node) => { destinationRefs.current[row.id] = node; }} value={destinationValue} disabled={loadingDestinations} onChange={(event) => changeDestination(row, event.target.value)} className={selectClass}>
                      <option value="">{loadingDestinations ? "Loading..." : "Select destination"}</option>
                      {destinationValue === "__saved__" && <option value="__saved__">{row.destination} (saved)</option>}
                      {destinations.map((item) => <option key={destinationIdOf(item) || item.name} value={String(destinationIdOf(item))}>{item.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>

                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">City</span>
                  <div className="relative">
                    <select value={cityValue} disabled={!destinationValue || loadingRows[row.id]} onChange={(event) => changeCity(row, event.target.value)} className={selectClass}>
                      <option value="">{loadingRows[row.id] ? "Loading cities..." : destinationValue ? "Select city" : "Select destination first"}</option>
                      {cityValue === "__saved__" && <option value="__saved__">{row.city} (saved)</option>}
                      {cities.map((item) => <option key={cityIdOf(item) || item.name} value={String(cityIdOf(item))}>{item.name}</option>)}
                    </select>
                    {loadingRows[row.id] ? <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" /> : <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
                  </div>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
                  <input type="number" min="0" step="1" value={row.nights} onFocus={(event) => event.target.select()} onChange={(event) => onUpdate(row.id, "nights", event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (index === itinerary.length - 1) onAdd();
                    }
                  }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>

                <button type="button" onClick={() => onRemove(row.id)} disabled={itinerary.length === 1} className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:w-9" aria-label={`Remove stop ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{destinationError || "Use Tab to move across fields."}</span>
          <span>Press Enter in Nights to add the next stop.</span>
        </div>
      </div>
    </section>
  );
}
