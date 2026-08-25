// src/features/marketplace/components/amenityIcon.jsx
//
// An icon and a tone for a free-text amenity.
//
// WHY THIS EXISTS. The hotel page renders up to 43 amenities as an identical row of check marks, so
// an agent looking for one specific thing — "is there parking" — reads all of them. An icon per kind
// turns that into a scan. The colour is a by-product of the meaning, not decoration applied to it:
// water things are blue, food things are amber, and anything unrecognised stays slate rather than
// being assigned a colour it does not mean.
//
// MATCHING IS SUBSTRING, ON FREE TEXT, AND THAT IS THE ONLY OPTION. `platform_hotel_amenities` is a
// varchar typed by two different audiences — a SuperAdmin in the console and a hotel partner in the
// public form — so there is no enum to switch on and never will be one without a migration nobody has
// asked for. Order matters: the first rule that matches wins, so the more specific patterns come
// first ("airport shuttle" before "air conditioning" would be wrong, hence "air condition" is spelled
// out rather than matching a bare "air").
//
// UNKNOWN IS A FIRST-CLASS CASE. A new amenity nobody predicted renders with the neutral check, which
// is exactly what it did before this file existed. Nothing regresses; the recognised ones get better.

import {
  AirVent, Baby, Bath, BellRing, Bike, Car, Check, Coffee, ConciergeBell, Dumbbell, Flame,
  Landmark, Leaf, PawPrint, Plane, Salad, Shirt, ShowerHead, Snowflake, Sparkles, Tv, UtensilsCrossed,
  Waves, Wifi, Wind,
} from "lucide-react";

/** First match wins — put the specific before the general. */
const RULES = [
  [/wi-?fi|internet|broadband/,               Wifi,           "text-sky-600"],
  [/swimming|\bpool\b/,                       Waves,          "text-cyan-600"],
  [/spa|massage|jacuzzi|sauna/,               Sparkles,       "text-violet-600"],
  [/gym|fitness|workout/,                     Dumbbell,       "text-rose-600"],
  [/air ?condition|\bac\b|climate/,           AirVent,        "text-sky-600"],
  [/heater|heating|fireplace|bonfire|campfire/, Flame,        "text-orange-600"],
  [/parking|valet|garage/,                    Car,            "text-slate-600"],
  [/airport|shuttle|transfer|pick ?up/,       Plane,          "text-indigo-600"],
  [/restaurant|dining|dinner|multi ?cuisine/, UtensilsCrossed,"text-amber-600"],
  [/breakfast|\btea\b|coffee|cafe/,           Coffee,         "text-amber-700"],
  [/bar\b|lounge|pub/,                        Salad,          "text-emerald-600"],
  [/room ?service|concierge|reception|front ?desk/, ConciergeBell, "text-teal-600"],
  [/laundry|ironing|dry ?clean/,              Shirt,          "text-slate-600"],
  [/geyser|hot water|shower/,                 ShowerHead,     "text-cyan-700"],
  [/bath ?tub|bathroom|toiletries/,           Bath,           "text-cyan-700"],
  [/\btv\b|television|cable|netflix/,         Tv,             "text-slate-600"],
  [/refrigerator|fridge|mini ?bar/,           Snowflake,      "text-sky-700"],
  [/garden|lawn|terrace|balcony|view/,        Leaf,           "text-emerald-600"],
  [/temple|heritage|sightsee|tour/,           Landmark,       "text-amber-700"],
  [/pet/,                                     PawPrint,       "text-orange-700"],
  [/child|kid|baby|cot|crib/,                 Baby,           "text-pink-600"],
  [/bicycle|\bbike\b|trek|adventure/,         Bike,           "text-lime-700"],
  [/wake ?up|alarm|bell/,                     BellRing,       "text-slate-600"],
  [/fan|ventilation/,                         Wind,           "text-slate-600"],
];

/**
 * @param   {string} amenity free text as stored
 * @returns {{Icon: Function, tone: string}} never null — an unrecognised amenity gets the neutral check
 */
export function amenityIcon(amenity) {
  const s = String(amenity ?? "").toLowerCase();
  for (const [pattern, Icon, tone] of RULES) {
    if (pattern.test(s)) return { Icon, tone };
  }
  return { Icon: Check, tone: "text-slate-400" };
}

export default amenityIcon;
