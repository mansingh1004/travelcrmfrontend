// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { MapPinned, Plus, Trash2 } from "lucide-react";

// import { geographyService } from "@shared/api/geographyService";
// import { SearchableSelect } from "@features/leads";

// // OLD — the class both native <select>s shared:
// // const selectClass = "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 …";
// //
// // Destination and City are the two longest master lists a clerk meets on this form, and they were
// // the ones a keyboard could not reach: a native select answers a keystroke by jumping to the next
// // option starting with that letter, then forgets it. Both are the app's combobox now — the same
// // control Create Lead uses — so typing three letters actually narrows the list.
// const comboClass = "hover:border-slate-300 disabled:bg-slate-50";

// const normalize = (value) => String(value ?? "").trim().toLowerCase();
// const destinationIdOf = (item) => item?.id ?? item?.destinationId ?? item?.publicId ?? "";
// const cityIdOf = (item) => item?.id ?? item?.cityId ?? item?.publicId ?? "";

// export default function FastItinerary({ hydrationKey, itinerary, onAdd, onRemove, onUpdate }) {
//   const [destinations, setDestinations] = useState([]);
//   const [loadingDestinations, setLoadingDestinations] = useState(true);
//   const [destinationError, setDestinationError] = useState("");
//   const [rowCities, setRowCities] = useState({});
//   const [loadingRows, setLoadingRows] = useState({});
//   const destinationRefs = useRef({});
//   const previousLengthRef = useRef(itinerary.length);

//   useEffect(() => {
//     let active = true;
//     geographyService.getAllDestinations()
//       .then((list) => {
//         if (active) setDestinations(Array.isArray(list) ? list : []);
//       })
//       .catch(() => {
//         if (active) {
//           setDestinations([]);
//           setDestinationError("Could not load destination master.");
//         }
//       })
//       .finally(() => {
//         if (active) setLoadingDestinations(false);
//       });
//     return () => { active = false; };
//   }, []);

//   const loadCities = useCallback(async (rowId, destinationId) => {
//     if (!destinationId) {
//       setRowCities((current) => ({ ...current, [rowId]: [] }));
//       return [];
//     }

//     setLoadingRows((current) => ({ ...current, [rowId]: true }));
//     try {
//       const list = await geographyService.getCitiesByDestination(destinationId);
//       const cities = Array.isArray(list) ? list : [];
//       setRowCities((current) => ({ ...current, [rowId]: cities }));
//       return cities;
//     } catch {
//       setRowCities((current) => ({ ...current, [rowId]: [] }));
//       return [];
//     } finally {
//       setLoadingRows((current) => ({ ...current, [rowId]: false }));
//     }
//   }, []);

//   useEffect(() => {
//     if (loadingDestinations || destinations.length === 0) return undefined;
//     let active = true;

//     const hydrate = async () => {
//       for (const row of itinerary) {
//         if (!active || rowCities[row.id]) continue;
//         const destination = destinations.find((item) =>
//           (row.destinationId && String(destinationIdOf(item)) === String(row.destinationId)) ||
//           (!row.destinationId && normalize(item.name) === normalize(row.destination))
//         );
//         if (!destination) continue;
//         const destinationId = String(destinationIdOf(destination));
//         if (!row.destinationId) onUpdate(row.id, "destinationId", destinationId);
//         if (!row.destination) onUpdate(row.id, "destination", destination.name || "");
//         const cities = await loadCities(row.id, destinationId);
//         if (!active || row.cityId || !row.city) continue;
//         const city = cities.find((item) => normalize(item.name) === normalize(row.city));
//         if (city) onUpdate(row.id, "cityId", String(cityIdOf(city)));
//       }
//     };

//     hydrate();
//     return () => { active = false; };
//   }, [destinations, hydrationKey, itinerary, loadCities, loadingDestinations, onUpdate, rowCities]);

//   useEffect(() => {
//     if (itinerary.length > previousLengthRef.current) {
//       const lastRow = itinerary[itinerary.length - 1];
//       window.setTimeout(() => destinationRefs.current[lastRow?.id]?.focus(), 0);
//     }
//     previousLengthRef.current = itinerary.length;
//   }, [itinerary]);

//   const destinationOptions = useMemo(
//     () => destinations.map((item) => ({ value: String(destinationIdOf(item)), label: item.name || "" })),
//     [destinations]
//   );

//   const changeDestination = async (row, id) => {
//     const destination = destinations.find((item) => String(destinationIdOf(item)) === String(id));
//     onUpdate(row.id, "destinationId", id);
//     onUpdate(row.id, "destination", destination?.name || "");
//     onUpdate(row.id, "cityId", "");
//     onUpdate(row.id, "city", "");
//     await loadCities(row.id, id);
//   };

//   const changeCity = (row, id) => {
//     const city = (rowCities[row.id] || []).find((item) => String(cityIdOf(item)) === String(id));
//     onUpdate(row.id, "cityId", id);
//     onUpdate(row.id, "city", city?.name || "");
//   };

//   return (
//     <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
//       <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
//         <div className="flex items-center gap-3">
//           <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
//             <MapPinned className="h-4 w-4" />
//           </span>
//           <div>
//             <h2 className="text-sm font-bold text-slate-800">Travel Itinerary</h2>
//             <p className="mt-0.5 text-xs text-slate-500">Destination, city and nights in compact rows</p>
//           </div>
//         </div>
//         <button type="button" onClick={onAdd} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
//           <Plus className="h-3.5 w-3.5" /> Add Stop
//         </button>
//       </div>

//       <div className="p-4 sm:p-5">
//         <div className="mb-2 hidden grid-cols-[38px_minmax(0,1fr)_minmax(0,1fr)_110px_38px] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
//           <span>#</span><span>Destination</span><span>City</span><span>Nights</span><span />
//         </div>

//         <div className="space-y-2.5">
//           {itinerary.map((row, index) => {
//             const cities = rowCities[row.id] || [];
//             const selectedDestination = destinations.find((item) =>
//               (row.destinationId && String(destinationIdOf(item)) === String(row.destinationId)) ||
//               normalize(item.name) === normalize(row.destination)
//             );
//             const destinationValue = selectedDestination ? String(destinationIdOf(selectedDestination)) : row.destination ? "__saved__" : "";
//             const selectedCity = cities.find((item) =>
//               (row.cityId && String(cityIdOf(item)) === String(row.cityId)) || normalize(item.name) === normalize(row.city)
//             );
//             const cityValue = selectedCity ? String(cityIdOf(selectedCity)) : row.city ? "__saved__" : "";

//             /* A row loaded from a lead or a booking snapshot can name a place that is no longer in
//                the master list. The native selects carried a "(saved)" option for exactly that, and
//                without it the combobox would find no label for the value and fall back to the
//                placeholder — i.e. silently show an empty row over saved data. */
//             const rowDestinationOptions = destinationValue === "__saved__"
//               ? [{ value: "__saved__", label: `${row.destination} (saved)` }, ...destinationOptions]
//               : destinationOptions;
//             const cityOptions = cities.map((item) => ({ value: String(cityIdOf(item)), label: item.name || "" }));
//             const rowCityOptions = cityValue === "__saved__"
//               ? [{ value: "__saved__", label: `${row.city} (saved)` }, ...cityOptions]
//               : cityOptions;

//             return (
//               <div key={row.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[38px_minmax(0,1fr)_minmax(0,1fr)_110px_38px] md:items-center md:border-0 md:bg-transparent md:p-0">
//                 <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:flex">{index + 1}</span>

//                 <div className="min-w-0">
//                   <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Destination</span>
//                   <SearchableSelect
//                     triggerRef={(node) => { destinationRefs.current[row.id] = node; }}
//                     options={rowDestinationOptions}
//                     value={destinationValue}
//                     onChange={(next) => { if (next !== "__saved__") changeDestination(row, next); }}
//                     placeholder={loadingDestinations ? "Loading..." : "Select destination"}
//                     searchPlaceholder="Type a destination..."
//                     loading={loadingDestinations}
//                     accent="blue"
//                     advanceOnSelect
//                     className={comboClass}
//                   />
//                 </div>

//                 <div className="min-w-0">
//                   <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">City</span>
//                   <SearchableSelect
//                     options={rowCityOptions}
//                     value={cityValue}
//                     onChange={(next) => { if (next !== "__saved__") changeCity(row, next); }}
//                     placeholder={loadingRows[row.id] ? "Loading cities..." : destinationValue ? "Select city" : "Select destination first"}
//                     searchPlaceholder="Type a city..."
//                     loading={Boolean(loadingRows[row.id])}
//                     disabled={!destinationValue}
//                     accent="blue"
//                     advanceOnSelect
//                     className={comboClass}
//                   />
//                 </div>

//                 <label>
//                   <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
//                   <input type="number" min="0" step="1" value={row.nights} onFocus={(event) => event.target.select()} onChange={(event) => onUpdate(row.id, "nights", event.target.value)} onKeyDown={(event) => {
//                     if (event.key === "Enter") {
//                       event.preventDefault();
//                       if (index === itinerary.length - 1) onAdd();
//                     }
//                   }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
//                 </label>

//                 <button type="button" onClick={() => onRemove(row.id)} disabled={itinerary.length === 1} className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:w-9" aria-label={`Remove stop ${index + 1}`}>
//                   <Trash2 className="h-4 w-4" />
//                 </button>
//               </div>
//             );
//           })}
//         </div>

//         <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
//           <span>{destinationError || "Use Tab to move across fields."}</span>
//           <span>Press Enter in Nights to add the next stop.</span>
//         </div>
//       </div>
//     </section>
//   );
// }













import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPinned, Plus, Trash2 } from "lucide-react";

import { geographyService } from "@shared/api/geographyService";
import { SearchableSelect } from "@features/leads";

// OLD — the class both native <select>s shared:
// const selectClass = "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 …";
//
// Destination and City are the two longest master lists a clerk meets on this form, and they were
// the ones a keyboard could not reach: a native select answers a keystroke by jumping to the next
// option starting with that letter, then forgets it. Both are the app's combobox now — the same
// control Create Lead uses — so typing three letters actually narrows the list.
const comboClass = "hover:border-slate-300 disabled:bg-slate-50";

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const destinationIdOf = (item) => item?.id ?? item?.destinationId ?? item?.publicId ?? "";
const cityIdOf = (item) => item?.id ?? item?.cityId ?? item?.publicId ?? "";

/* ─── Mock geography ──────────────────────────────────────────────────────────────────────────
   Flip USE_MOCK to false and the component goes straight back to geographyService: the two
   fetch helpers below return the SAME shapes and the same Promises the service does, so the
   loading flags, the "Loading cities..." placeholder and the error branch all still exercise the
   code they exercise against the real master data. A mock that resolved synchronously would hide
   every one of those paths and they would break the day the mock came out. */
const USE_MOCK = true;

const MOCK_DESTINATIONS = [
  { id: "np", name: "Nepal" },
  { id: "in", name: "India" },
  { id: "bt", name: "Bhutan" },
];

const MOCK_CITIES = {
  np: [
    { id: "np-lum", name: "Lumbini" },
    { id: "np-cwn", name: "Chitwan" },
    { id: "np-pkr", name: "Pokhara" },
    { id: "np-ktm", name: "Kathmandu" },
    { id: "np-nag", name: "Nagarkot" },
  ],
  in: [
    { id: "in-gkp", name: "Gorakhpur" },
    { id: "in-vns", name: "Varanasi" },
    { id: "in-del", name: "Delhi" },
    { id: "in-luc", name: "Lucknow" },
  ],
  bt: [
    { id: "bt-par", name: "Paro" },
    { id: "bt-thi", name: "Thimphu" },
  ],
};

const fetchDestinations = () =>
  USE_MOCK ? Promise.resolve(MOCK_DESTINATIONS) : geographyService.getAllDestinations();

const fetchCities = (destinationId) =>
  USE_MOCK
    ? Promise.resolve(MOCK_CITIES[String(destinationId)] || [])
    : geographyService.getCitiesByDestination(destinationId);

/* Every city in one list for the "Start from" box, because the trip STARTS somewhere the trip is
   not about — Gorakhpur is in India on a Nepal booking, so this one control cannot be filtered by
   the row's destination the way the City column is. The country rides in the label so two cities
   of the same name stay tellable apart. Names, not ids: the start is a display-only anchor for the
   derived legs and it is compared against row.city, which is a name too. */
const ALL_CITY_OPTIONS = Object.entries(MOCK_CITIES).flatMap(([destinationId, cities]) => {
  const destination = MOCK_DESTINATIONS.find((item) => String(item.id) === destinationId);
  return cities.map((city) => ({
    value: city.name,
    label: `${city.name} (${destination?.name || "—"})`,
  }));
});

/* ─── Stays → days ────────────────────────────────────────────────────────────────────────────
   The rows are STAYS ("Pokhara, 2 nights"); the schedule people actually read is DAYS
   ("Day 3 Pokhara → Pokhara"). The second is derivable from the first, so it is derived rather
   than typed: nights are what generate the repeated days, which means changing a 2 to a 3 inserts
   a day and pushes the return leg along on its own, instead of forcing every later row to be
   retyped.

   A stay of 0 nights is a place you pass through, not a place you sleep, so it produces no day of
   its own — it rides on the next day's leg as a "via".

   `fromOf(index)` is passed in rather than tracked here, because From is the clerk's to set: the
   row's own From opens the leg, and only the repeat nights are chained off the row's To. */
const buildDays = (rows, fromOf, returnToStart) => {
  const days = [];
  const startCity = String(fromOf(0) || "").trim();
  let current = startCity;
  let pendingVia = [];

  rows.forEach((row, index) => {
    const city = String(row.city || "").trim();
    if (!city) return;
    const nights = Number(row.nights) || 0;

    if (nights === 0) {
      pendingVia.push(city);
      return;
    }

    for (let night = 0; night < nights; night += 1) {
      const arriving = night === 0;
      days.push({
        // Arriving day travels from whatever this row says; every night after it stays put.
        from: arriving ? String(fromOf(index) || current || "").trim() : city,
        to: city,
        night: night + 1,
        nights,
        via: arriving ? pendingVia : [],
      });
      if (arriving) pendingVia = [];
      current = city;
    }
  });

  if (returnToStart && current && startCity && current !== startCity) {
    days.push({ from: current, to: startCity, isReturn: true, via: pendingVia });
  }

  return days;
};

export default function FastItinerary({ hydrationKey, itinerary, onAdd, onRemove, onUpdate }) {
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [destinationError, setDestinationError] = useState("");
  /* ONE city list for the whole panel, not one per row. The trip has a single destination now, so
     every row draws from the same list — which also means a new stop's To dropdown is populated the
     instant it appears, instead of each row fetching the same country's cities over again. */
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const toRefs = useRef({});
  const previousLengthRef = useRef(itinerary.length);
  /* The trip's one destination — the clerk's pick if they made one, otherwise whatever the loaded
     rows already name. `undefined` means "not picked here", which is what lets a lead or an edit
     seed the control without an effect writing state behind it.
     NOTE: Booking Details already asks for a Destination of its own (CreateBookingClean.jsx:1648),
     so the two can be set to different countries. The fix is one prop from the parent; until then
     this is the one the itinerary rows are written with. */
  const [pickedDestinationId, setPickedDestinationId] = useState(undefined);
  const [seenHydrationKey, setSeenHydrationKey] = useState(hydrationKey);
  /* Each row's From, by row id, and whether the trip comes back to where it began. Local to this
     component: the itinerary row has no From of its own and nothing outside this file changes.

     A row is only in here once the clerk has actually SET its From. Until then fromOf() answers
     with the previous row's To, so a fresh row arrives pre-filled with the obvious answer and
     still takes any other one — that is the difference between a default and a lock. */
  const [rowFrom, setRowFrom] = useState({});
  const [returnToStart, setReturnToStart] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDestinations()
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

  /* A different record is being edited, so the clerk's pick no longer describes it — drop it and
     let the new rows seed the selector again. Adjusted during render rather than in an effect:
     React re-runs the render before committing, so the control never paints the previous booking's
     country for a frame the way an effect-based reset would. */
  if (hydrationKey !== seenHydrationKey) {
    setSeenHydrationKey(hydrationKey);
    setPickedDestinationId(undefined);
  }

  /* What the loaded rows already say the trip is. A booking opened for edit, or an itinerary seeded
     from a lead, arrives with every row naming its destination — reading it back means the selector
     shows the country instead of "Select destination" over a full table. */
  const seededDestinationId = useMemo(() => {
    const seeded = itinerary.find((row) => row.destinationId || row.destination);
    if (!seeded) return "";
    const match = destinations.find((item) =>
      (seeded.destinationId && String(destinationIdOf(item)) === String(seeded.destinationId)) ||
      (!seeded.destinationId && normalize(item.name) === normalize(seeded.destination))
    );
    return match ? String(destinationIdOf(match)) : "";
  }, [itinerary, destinations]);

  const tripDestinationId = pickedDestinationId ?? seededDestinationId;

  const tripDestination = useMemo(
    () => destinations.find((item) => String(destinationIdOf(item)) === String(tripDestinationId)) || null,
    [destinations, tripDestinationId]
  );
  const tripDestinationName = tripDestination?.name || "";

  useEffect(() => {
    if (!tripDestinationId) return undefined;
    let active = true;
    const load = async () => {
      setLoadingCities(true);
      try {
        const list = await fetchCities(tripDestinationId);
        if (active) setCities(Array.isArray(list) ? list : []);
      } catch {
        if (active) setCities([]);
      } finally {
        if (active) setLoadingCities(false);
      }
    };
    load();
    return () => { active = false; };
  }, [tripDestinationId]);

  /* The destination is chosen once and written onto every row, because the payload is still built
     per row (CreateBookingClean.jsx:1108) — the column left the screen, not the data. Rows that
     already agree are skipped, so this settles after one pass instead of looping on itself. */
  useEffect(() => {
    if (!tripDestinationId || !tripDestinationName) return;
    itinerary.forEach((row) => {
      if (String(row.destinationId || "") === String(tripDestinationId)) return;
      onUpdate(row.id, "destinationId", String(tripDestinationId));
      onUpdate(row.id, "destination", tripDestinationName);
    });
  }, [tripDestinationId, tripDestinationName, itinerary, onUpdate]);

  useEffect(() => {
    if (itinerary.length > previousLengthRef.current) {
      // From arrives pre-filled, so the caret belongs on To — the only box a new stop really needs.
      const lastRow = itinerary[itinerary.length - 1];
      window.setTimeout(() => toRefs.current[lastRow?.id]?.focus(), 0);
    }
    previousLengthRef.current = itinerary.length;
  }, [itinerary]);

  const destinationOptions = useMemo(
    () => destinations.map((item) => ({ value: String(destinationIdOf(item)), label: item.name || "" })),
    [destinations]
  );

  const cityOptions = useMemo(
    () => (tripDestinationId ? cities : []).map((item) => ({
      value: String(cityIdOf(item)),
      label: item.name || "",
    })),
    [cities, tripDestinationId]
  );

  /* What a row's From reads as right now: the clerk's answer if they gave one, otherwise the
     previous row's To. Row 0 has nothing before it, so it stays blank until it is filled — that
     blank IS the start of the trip. */
  const fromOf = useCallback((index) => {
    const row = itinerary[index];
    const chosen = row ? rowFrom[row.id] : undefined;
    if (chosen !== undefined) return chosen;
    return index === 0 ? "" : String(itinerary[index - 1]?.city || "").trim();
  }, [itinerary, rowFrom]);

  const setFrom = (rowId, value) => setRowFrom((current) => ({ ...current, [rowId]: value }));

  /* A row whose From is not the previous row's To leaves a hole in the route — you end a day in
     Chitwan and start the next one somewhere you never travelled to. It is reported, not blocked:
     an open-jaw trip (fly into one city, out of another) is a real booking, and refusing to save it
     would be wrong. */
  const gapAt = (index) => {
    if (index === 0) return "";
    const previousTo = String(itinerary[index - 1]?.city || "").trim();
    const from = String(fromOf(index) || "").trim();
    if (!previousTo || !from || normalize(previousTo) === normalize(from)) return "";
    return previousTo;
  };

  const days = useMemo(
    () => buildDays(itinerary, fromOf, returnToStart),
    [itinerary, fromOf, returnToStart]
  );

  const routeStops = useMemo(() => {
    const start = String(fromOf(0) || "").trim();
    const stops = [start, ...itinerary.map((row) => String(row.city || "").trim())].filter(Boolean);
    if (returnToStart && start && stops[stops.length - 1] !== start) stops.push(start);
    return stops;
  }, [itinerary, fromOf, returnToStart]);

  const totalNights = itinerary.reduce((sum, row) => sum + (Number(row.nights) || 0), 0);
  const startCity = String(fromOf(0) || "").trim();

  /* Changing the country does NOT wipe the rows. The cities that no longer belong keep showing as
     "(saved)" — the same treatment this panel already gives a place that has left the master list —
     so a mis-click costs a re-pick instead of the whole table. */
  const changeCity = (row, id) => {
    const city = cities.find((item) => String(cityIdOf(item)) === String(id));
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
            <p className="mt-0.5 text-xs text-slate-500">Pick the country once, then the stops city to city</p>
          </div>
        </div>
        <button type="button" onClick={onAdd} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">
          <Plus className="h-3.5 w-3.5" /> Add Stop
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {/* Destination, once, above the stops it governs. It used to sit on every row, which meant
            picking "Nepal" as many times as the trip had stops — the country is a property of the
            trip, the city is what actually differs stop to stop. */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="shrink-0 text-xs font-semibold text-slate-500">Trip destination</span>
          <div className="min-w-0 sm:max-w-xs sm:flex-1">
            <SearchableSelect
              options={destinationOptions}
              value={tripDestinationId}
              onChange={setPickedDestinationId}
              placeholder={loadingDestinations ? "Loading..." : "Select destination"}
              searchPlaceholder="Type a destination..."
              loading={loadingDestinations}
              accent="blue"
              advanceOnSelect
              className={comboClass}
            />
          </div>
          {tripDestinationName && (
            <span className="text-[11px] font-semibold text-slate-400">
              Every stop below is in {tripDestinationName}
            </span>
          )}
        </div>

        {/* Route summary + return. There is no separate "start" control: the first row's From IS
            where the trip starts, so asking for it twice would be two fields that must agree. */}
        {(routeStops.length > 1 || startCity) && (
          <div className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs">
            {routeStops.map((stop, index) => (
              <span key={`${stop}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-slate-300">→</span>}
                <span className="font-bold text-slate-700">{stop}</span>
              </span>
            ))}
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-extrabold text-blue-700">
              {totalNights}N
            </span>
            <label className="ml-auto flex cursor-pointer items-center gap-2 font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={returnToStart}
                onChange={(event) => setReturnToStart(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-400"
              />
              Return to {startCity || "start"}
            </label>
          </div>
        )}

        <div className="mb-2 hidden grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_84px_34px] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 md:grid">
          <span>#</span><span>From</span><span>To</span><span>Nights</span><span />
        </div>

        <div className="space-y-2.5">
          {itinerary.map((row, index) => {
            const selectedCity = (tripDestinationId ? cities : []).find((item) =>
              (row.cityId && String(cityIdOf(item)) === String(row.cityId)) || normalize(item.name) === normalize(row.city)
            );
            const cityValue = selectedCity ? String(cityIdOf(selectedCity)) : row.city ? "__saved__" : "";

            /* A row can name a city that is not in the current list — either because it left the
               master data, or because the trip destination was just switched out from under it.
               Either way it keeps showing as "(saved)" instead of the combobox falling back to its
               placeholder and silently blanking a row that has data in it. */
            const rowCityOptions = cityValue === "__saved__"
              ? [{ value: "__saved__", label: `${row.city} (saved)` }, ...cityOptions]
              : cityOptions;

            return (
              <div key={row.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_84px_34px] md:items-start md:border-0 md:bg-transparent md:p-0">
                <span className="hidden h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500 md:mt-1 md:flex">{index + 1}</span>

                {/* From — every city in the app, not the trip destination's list: the leg into Nepal
                    starts in India, so filtering this by the trip's country would hide the one
                    answer it needs. Pre-filled with the previous row's To and freely overridable. */}
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">From</span>
                  <SearchableSelect
                    options={ALL_CITY_OPTIONS}
                    value={fromOf(index)}
                    onChange={(next) => setFrom(row.id, next)}
                    placeholder={index === 0 ? "Where does the trip start?" : "Coming from..."}
                    searchPlaceholder="Type a city..."
                    accent="blue"
                    advanceOnSelect
                    className={comboClass}
                  />
                  {gapAt(index) && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-600">
                      Previous stop ends at {gapAt(index)}
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">To</span>
                  <SearchableSelect
                    triggerRef={(node) => { toRefs.current[row.id] = node; }}
                    options={rowCityOptions}
                    value={cityValue}
                    onChange={(next) => { if (next !== "__saved__") changeCity(row, next); }}
                    placeholder={loadingCities ? "Loading cities..." : tripDestinationId ? "Select city" : "Pick the trip destination first"}
                    searchPlaceholder="Type a city..."
                    loading={loadingCities}
                    disabled={!tripDestinationId}
                    accent="blue"
                    advanceOnSelect
                    className={comboClass}
                  />
                  {/* The leg this row turns into, under the box that decides it — so a wrong stop
                      is visible where it was picked, not only down in the day schedule. */}
                  {row.city && fromOf(index) && (
                    <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">
                      {fromOf(index)} → {row.city}
                    </p>
                  )}
                </div>

                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">Nights</span>
                  {/* stopPropagation, not just preventDefault: without it this Enter adds the stop
                      AND the page's form-level Enter-advance runs on the same keystroke, so one
                      press did two things and only landed right because the new row's focus timer
                      happened to fire last. One key, one action. */}
                  <input type="number" min="0" step="1" value={row.nights} onFocus={(event) => event.target.select()} onChange={(event) => onUpdate(row.id, "nights", event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      if (index === itinerary.length - 1) onAdd();
                    }
                  }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>

                {/* tabIndex={-1} keeps Delete off the Enter path. The page advances focus on Enter
                    and its handler deliberately ignores buttons (a focused button's Enter IS its
                    click), so a clerk holding Enter down the form would land here and silently
                    destroy the row they had just filled — no prompt, no undo. Deleting a stop is
                    rare and irreversible; it should cost a deliberate click, not a keystroke you
                    were already pressing. */}
                <button type="button" tabIndex={-1} onClick={() => onRemove(row.id)} disabled={itinerary.length === 1} className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:w-9" aria-label={`Remove stop ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Day schedule ──────────────────────────────────────────────────────────────────
            Read-only, and that is the point: it is the rows above expanded by their own night
            counts, so a second night in Pokhara shows up as "Pokhara → Pokhara" without anyone
            typing it and a changed night count re-numbers every day after it. Nothing here is
            editable, because there is nothing here that is not already above. */}
        {days.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Day schedule
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {days.length} {days.length === 1 ? "day" : "days"}
              </span>
            </div>
            <ol className="divide-y divide-slate-100">
              {days.map((day, index) => (
                <li key={index} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
                  <span className="w-12 shrink-0 font-extrabold text-slate-400">Day {index + 1}</span>
                  <span className="font-bold text-slate-700">{day.from || "—"}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-bold text-slate-700">{day.to || "—"}</span>
                  {day.via.length > 0 && (
                    <span className="text-[11px] font-semibold text-slate-400">via {day.via.join(", ")}</span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-slate-400">
                    {day.isReturn
                      ? "return"
                      : day.from === day.to
                        ? `stay · night ${day.night} of ${day.nights}`
                        : `night ${day.night} of ${day.nights}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{destinationError || "Use Tab to move across fields."}</span>
          <span>Press Enter in Nights to add the next stop.</span>
        </div>
      </div>
    </section>
  );
}
