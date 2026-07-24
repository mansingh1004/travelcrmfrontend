import { useEffect, useState } from "react";
import { Calendar as FiCalendar, Globe as FiGlobe, MapPin as FiMapPin, House as FiHome, Users as FiUsers, PersonStanding as MdChildCare, Baby as MdBabyChangingStation, BedDouble as MdHotel } from "lucide-react";

import { geographyService } from "@shared/api/geographyService";
import { getErrorMessage } from "@shared/api/apiError";
import SearchableSelect from "./SearchableSelect";

function NumberInput({ label, icon: Icon, value, onChange, min = 0, max = 20, color = "blue" }) {
  const colorMap = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", btn: "bg-blue-100 hover:bg-blue-200 text-blue-700" },
    green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", btn: "bg-green-100 hover:bg-green-200 text-green-700" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", btn: "bg-orange-100 hover:bg-orange-200 text-orange-700" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", btn: "bg-purple-100 hover:bg-purple-200 text-purple-700" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", btn: "bg-rose-100 hover:bg-rose-200 text-rose-700" },
  };
  const c = colorMap[color];

  return (
    <div className={`${c.bg} rounded-xl p-3 border ${c.border}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${c.text}`} />
        <span className="text-xs font-semibold text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className={`w-7 h-7 rounded-lg ${c.btn} font-bold text-sm transition-all flex items-center justify-center`}
        >
          −
        </button>
        <span className={`flex-1 text-center text-base font-bold ${c.text}`}>{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className={`w-7 h-7 rounded-lg ${c.btn} font-bold text-sm transition-all flex items-center justify-center`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function TravelDetails({
  register,
  watch,
  setValue,
  getValues,
}) {
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [error, setError] = useState(null);

  const rooms = watch("rooms") || 1;
  const adults = watch("adults") || 2;
  const children = watch("children") || 0;
  const infants = watch("infants") || 0;
  const extraBeds = watch("extraBeds") || 0;

  useEffect(() => {
    setValue("rooms", 1);
    setValue("adults", 2);
    setValue("children", 0);
    setValue("infants", 0);
    setValue("extraBeds", 0);
  }, []);

  // useEffect(() => {
  //   geographyService.getCountries()
  //     .then((list) => {
  //       setCountries(list);

  //       // ── AUTO-SELECT: Departing Country = India (default) ──
  //       // List load hone ke baad India ko canonical value se set karte hain
  //       // taaki SearchableSelect mein properly selected dikhe. User ne agar
  //       // pehle se koi doosra country choose kiya ho toh usse nahi chhedte.
  //       const current = watch("departCountry");
  //       if (!current || current === "India") {
  //         const india = (Array.isArray(list) ? list : []).find((c) => {
  //           const name = typeof c === "string" ? c : (c?.name || c?.countryName || "");
  //           return name.trim().toLowerCase() === "india";
  //         });
  //         const value = india
  //           ? (typeof india === "string" ? india : (india.name || india.countryName))
  //           : "India";
  //         setValue("departCountry", value, { shouldValidate: true });
  //       }
  //     })
  //     // Was `err.message` — an axios error, so the user saw "Request failed with status code 500".
  //     .catch((err) => setError(getErrorMessage(err, "Couldn't load countries.")))
  //     .finally(() => setLoadingCountries(false));
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
  let isMounted = true;

  const getCountryName = (country) => {
    if (typeof country === "string") {
      return country.trim();
    }

    return String(
      country?.name ||
      country?.countryName ||
      country?.label ||
      ""
    ).trim();
  };

  const loadCountries = async () => {
    setLoadingCountries(true);
    setError(null);

    try {
      const response = await geographyService.getCountries();

      const rawCountries = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : Array.isArray(response?.content)
              ? response.content
              : [];

      /*
       * SearchableSelect ko { value, label } objects chahiye.
       *
       * Result:
       * [
       *   { value: "India", label: "India" },
       *   { value: "Nepal", label: "Nepal" }
       * ]
       */
      const countryOptions = rawCountries
        .map((country) => {
          const countryName = getCountryName(country);

          if (!countryName) return null;

          return {
            value: countryName,
            label: countryName,
          };
        })
        .filter(Boolean)
        .filter(
          (country, index, array) =>
            array.findIndex(
              (item) =>
                item.value.toLowerCase() ===
                country.value.toLowerCase()
            ) === index
        );

      if (!isMounted) return;

      setCountries(countryOptions);

      const indiaOption = countryOptions.find(
        (country) =>
          country.value.toLowerCase() === "india"
      );

      const currentCountry = getValues("departCountry");

      /*
       * Create form open hone par India select hogi.
       * Existing different country ko overwrite nahi karega.
       */
      if (
        !currentCountry ||
        String(currentCountry).toLowerCase() === "india"
      ) {
        setValue(
          "departCountry",
          indiaOption?.value || "India",
          {
            shouldValidate: true,
            shouldDirty: false,
            shouldTouch: false,
          }
        );
      }
    } catch (err) {
      if (!isMounted) return;

      setCountries([]);

      setError(
        getErrorMessage(
          err,
          "Couldn't load countries."
        )
      );
    } finally {
      if (isMounted) {
        setLoadingCountries(false);
      }
    }
  };

  loadCountries();

  return () => {
    isMounted = false;
  };
}, [getValues, setValue]);


  // console.log(countries)

  const totalTravellers = adults + children + infants;

  const summary = [
    rooms > 0 && `${rooms} Room${rooms > 1 ? "s" : ""}`,
    adults > 0 && `${adults} Adult${adults > 1 ? "s" : ""}`,
    children > 0 && `${children} Child${children > 1 ? "ren" : ""}`,
    infants > 0 && `${infants} Infant${infants > 1 ? "s" : ""}`,
    extraBeds > 0 && `${extraBeds} Extra Bed${extraBeds > 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <FiGlobe className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base">Travel Details</h2>
          <p className="text-teal-100 text-xs">Departure, dates & traveller information</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Travel Date */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <FiCalendar className="w-3.5 h-3.5 text-teal-500" />
            Travel Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
              {...register("travelDate")}
            />
          </div>
        </div>

        {/* Country + City */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
              <FiGlobe className="w-3.5 h-3.5 text-teal-500" />
              Departing Country
            </label>
            {/* <SearchableSelect
              options={countries}
              value={watch("departCountry")}
              onChange={(val) => setValue("departCountry", val, { shouldValidate: true })}
              placeholder="Select country"
              loading={loadingCountries}
              icon={FiGlobe}
              searchable={true}
            /> */}

            <SearchableSelect
  options={countries}
  value={watch("departCountry") || ""}
  onChange={(value) => {
    setValue("departCountry", value, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }}
  placeholder="Select country"
  loading={loadingCountries}
  icon={FiGlobe}
  searchable
/>
            {error && (
              <span className="text-xs text-red-500">Failed to load countries: {error}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
              <FiMapPin className="w-3.5 h-3.5 text-teal-500" />
              Departing City
            </label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter departing city"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
                  focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all"
                {...register("departCity")}
              />
            </div>
          </div>
        </div>

        {/* Rooms + Adults */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumberInput label="Rooms" icon={FiHome} value={rooms} onChange={(v) => setValue("rooms", v)} min={1} color="blue" />
          <NumberInput label="Adults" icon={FiUsers} value={adults} onChange={(v) => setValue("adults", v)} min={1} color="green" />
          <NumberInput label="Children" icon={MdChildCare} value={children} onChange={(v) => setValue("children", v)} color="orange" />
          <NumberInput label="Infants" icon={MdBabyChangingStation} value={infants} onChange={(v) => setValue("infants", v)} color="purple" />
          <NumberInput label="Extra Beds" icon={MdHotel} value={extraBeds} onChange={(v) => setValue("extraBeds", v)} color="rose" />
        </div>

        {/* Summary */}
        {totalTravellers > 0 && (
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl px-4 py-3 border border-teal-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <FiUsers className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Traveller Summary</p>
              <p className="text-sm font-bold text-slate-700">{summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}