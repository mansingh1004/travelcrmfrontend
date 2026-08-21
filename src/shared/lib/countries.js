/*
 * Hotel registration stores ISO-2 country codes because catalog promotion matches on that value.
 * The UI never asks an owner to know those codes: it shows readable names and keeps the code only
 * as the <option> value sent to the existing API.
 *
 * This code list mirrors backend/data/countries.json, so public registration needs no authenticated
 * master-data request and still works before the hotel belongs to any tenant.
 */
const ISO_COUNTRY_CODES = (
  "AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI " +
  "KH CM CA CV CF TD CL CN CO KM CG CD CR HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET " +
  "FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT CI JM JP " +
  "JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC " +
  "MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO " +
  "RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW " +
  "TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW"
).split(" ");

const regionNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

const displayName = (code) => {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
};

export const COUNTRY_OPTIONS = ISO_COUNTRY_CODES
  .map((code) => ({ code, name: displayName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const NAME_BY_CODE = new Map(COUNTRY_OPTIONS.map(({ code, name }) => [code, name]));

export function countryNameFromCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return code ? (NAME_BY_CODE.get(code) || value) : "";
}
