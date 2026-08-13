// src/services/geographyService.js
// ─────────────────────────────────────────────────────────────
// Geography cascade API client (Country → Destination → City).
//
// Uses the shared axiosInstance (baseURL ".../api") so the JWT
// interceptor and 401→login redirect are applied consistently.
//
// Backed entirely by the real unified dropdown endpoints — no mock
// data, no fallback lists:
//   GET /masters/dropdown/countries
//   GET /masters/dropdown/destinations?countryId=
//   GET /masters/dropdown/cities?destinationId=
//   GET /masters/dropdown/cities?countryId=
//
// The backend returns DropdownDto { value: Long, label: String }.
// We normalise every list to { id, name } so the UI code stays uniform.
// ─────────────────────────────────────────────────────────────

import API from "@shared/api/http";

// DropdownDto { value, label } → { id, name }
const toOptions = (res) =>
  (res.data?.data ?? []).map((o) => ({ id: o.value ?? o.id, name: o.label ?? o.name }));

export const geographyService = {
  /** All countries for the tenant. → [{ id, name }] */
  getCountries: () => API.get("/masters/dropdown/countries").then(toOptions),

  /** Active destinations under a country (incl. global). → [{ id, name }] */
  getDestinationsByCountry: (countryId) =>
    API.get("/masters/dropdown/destinations", { params: { countryId } }).then(toOptions),

  /** ALL active destinations visible to the tenant (no country filter). → [{ id, name }] */
  getAllDestinations: () =>
    API.get("/masters/dropdown/destinations").then(toOptions),

  /** Cities linked to a destination. → [{ id, name }] */
  getCitiesByDestination: (destinationId) =>
    API.get("/masters/dropdown/cities", { params: { destinationId } }).then(toOptions),

  /** Cities belonging directly to a country. → [{ id, name }] */
  getCitiesByCountry: (countryId) =>
    API.get("/masters/dropdown/cities", { params: { countryId } }).then(toOptions),

  /**
   * Cities under a destination resolved by NAME (CityDto list). Used where the
   * record stores the destination as a name string rather than an id
   * (e.g. Sightseeing). → [{ id, name }]
   */
  getCitiesByDestinationName: (destinationName) =>
    API.get("/destinations/cities", { params: { destination: destinationName } })
      .then((r) => (r.data?.data ?? []).map((c) => ({ id: c.cityId ?? c.id, name: c.name }))),

  /**
   * Full DestinationDto for a single destination (used to resolve the parent
   * countryId when pre-filling a cascade in edit mode).
   * → { destinationId, countryId, countryName, name, ... } | null
   */
  getDestinationById: (destinationId) =>
    API.get(`/destinations/${destinationId}`).then((r) => r.data?.data ?? null),

  /**
   * Every city the tenant can pick, ACROSS countries, each tagged with the country it came from.
   * → [{ id, name, countryId, countryName, stateName? }]
   *
   * The booking route editor needs this: a leg is a place, not a package region, and a trip is
   * routinely picked up outside the destination it sells (a Nepal package boarding at Gorakhpur).
   * Scoping to one country or to the chosen destination would hide exactly those cities.
   *
   * Composed from the per-country dropdown rather than a single unscoped call because
   * /masters/dropdown/cities is only known to answer with a countryId or destinationId, and the
   * MASTER /cities endpoint that would return everything sits behind master permissions a booking
   * clerk does not necessarily hold. Countries are few, the calls run in parallel, and the result
   * is fetched once per editor mount.
   *
   * `stateName` is passed through if the dropdown DTO ever carries it, so the "Pune — Maharashtra,
   * India" label starts working the moment the backend adds the field, with no change here.
   */
  getAllCitiesWithCountry: async () => {
    const countries = await geographyService.getCountries();
    const perCountry = await Promise.all(
      countries.map((country) =>
        API.get("/masters/dropdown/cities", { params: { countryId: country.id } })
          .then((res) =>
            (res.data?.data ?? []).map((city) => ({
              id: city.value ?? city.id,
              name: city.label ?? city.name,
              countryId: country.id,
              countryName: country.name,
              stateName: city.stateName ?? city.state ?? null,
            }))
          )
          // One country failing must not empty the whole picker.
          .catch(() => [])
      )
    );
    return perCountry.flat();
  },
};

export default geographyService;