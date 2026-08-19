// src/features/hotelpartner/components/GoogleListingPicker.jsx
//
// Lets a hotel owner point at their own Google listing, so their real guest rating and reviews show
// on the marketplace page travel agents book from.
//
// WHY THE OWNER PICKS AND NOTHING IS AUTO-MATCHED. A wrong place id does not fail. It succeeds, and
// puts a DIFFERENT property's rating and reviews on this hotel's page, where they read as genuine to
// every agent and every agent's customer. "Sunrise Resort, Aleo" and "Hotel Sunrise, Old Manali
// Road" are two businesses and one search result away from each other. So candidates are offered and
// the owner confirms — no auto-select, however confident the top match looks.
//
// WHY IT STORES NOTHING ITSELF. The chosen place id goes into form state and rides the next autosave
// like any other field. That is what keeps it under the same partner-editability rule as the rest of
// the form: once a registration is submitted, this cannot be changed behind the reviewer's back.
//
// EVERYTHING HERE IS OPTIONAL. An owner who cannot find their listing, or does not have one, skips
// it — the console can link it later. So a failed search says so quietly and never blocks Submit.

import { useState } from "react";
import { Check, ExternalLink, Loader2, Search, Star, X } from "lucide-react";
import { hotelPartnerService, partnerErrorMessage } from "../api/hotelPartnerService";
import { Btn, inputCls } from "./partnerUi";

/**
 * @param {object}   props
 * @param {string}   props.token     the registration token — this component's only credential
 * @param {string}   props.value     the chosen place id, or "" — lives in the page's form state
 * @param {Function} props.onChange  `(placeId) => void`
 * @param {object}   props.form      the live form, for the default query
 * @param {boolean}  props.disabled  read-only once the registration leaves the owner's hands
 */
export default function GoogleListingPicker({ token, value, onChange, form, disabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = never searched · [] = searched, none found
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  /* Remembered only for the session, so the confirmation reads "Hotel Sunrise, Old Manali Road"
     instead of a place id. It is deliberately NOT saved: Google's terms allow storing the place id
     indefinitely and its content only temporarily, and a name cached in our database would drift
     from theirs with nothing to correct it. On a later visit the owner sees the id and a Maps link,
     which is enough to recognise or replace it. */
  const [picked, setPicked] = useState(null);

  const defaultQuery = [form?.name, form?.address, form?.cityName, form?.stateName]
    .map((s) => (s ?? "").toString().trim())
    .filter(Boolean)
    .join(", ");

  const search = async () => {
    setError("");
    setSearching(true);
    try {
      const found = await hotelPartnerService.searchGoogle(token, query.trim());
      setResults(Array.isArray(found) ? found : []);
    } catch (err) {
      setResults([]);
      setError(partnerErrorMessage(err, "We could not search Google just now."));
    } finally {
      setSearching(false);
    }
  };

  const choose = (candidate) => {
    onChange(candidate.placeId);
    setPicked(candidate);
    setResults(null);
    setQuery("");
  };

  const clear = () => {
    onChange("");
    setPicked(null);
    setResults(null);
    setError("");
  };

  /* ── Chosen ─────────────────────────────────────────────────────────────── */
  if (value) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex items-start gap-2.5">
          <Check size={17} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            {picked ? (
              <>
                <p className="truncate text-[14px] font-bold text-slate-800">{picked.name}</p>
                {picked.address && (
                  <p className="truncate text-[13px] text-slate-600">{picked.address}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-[14px] font-bold text-slate-800">Google listing linked</p>
                <p className="truncate font-mono text-[12px] text-slate-500">{value}</p>
              </>
            )}
            <p className="mt-1 text-[12px] text-slate-500">
              Your Google rating and recent reviews will show on your page.
            </p>
          </div>
          {!disabled && (
            <Btn variant="ghost" size="sm" onClick={clear}>
              <X size={14} /> Remove
            </Btn>
          )}
        </div>
        {picked?.mapsUri && (
          <a
            href={picked.mapsUri}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-700 hover:underline"
          >
            <ExternalLink size={13} /> Check it on Google Maps
          </a>
        )}
      </div>
    );
  }

  /* ── Searching ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={query}
          disabled={disabled}
          placeholder={defaultQuery || "Your hotel's name and city"}
          /* Enter searches. The page's own Enter-to-next-field behaviour would otherwise skip past a
             box whose whole purpose is one keystroke, and an owner on a phone has no other affordance. */
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Btn onClick={search} busy={searching} disabled={disabled}>
          {!searching && <Search size={15} />} Search
        </Btn>
      </div>

      <p className="text-[12px] text-slate-500">
        Optional. Find your hotel on Google so travel agents see your real rating and reviews. Leave
        it blank if you are not sure — our team can link it for you.
      </p>

      {error && <p className="text-[13px] font-semibold text-rose-600">{error}</p>}

      {searching && (
        <p className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Searching Google…
        </p>
      )}

      {/* `results === null` is "not searched yet" and renders nothing — distinct from an empty array,
          which is a real answer the owner needs to see. */}
      {!searching && results?.length === 0 && (
        <p className="text-[13px] text-slate-500">
          We could not find it. Try adding your city, or skip this — it can be linked later.
        </p>
      )}

      {!searching && results?.length > 0 && (
        <ul className="space-y-2">
          {results.map((c) => (
            <li key={c.placeId}>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[14px] font-bold text-slate-800">{c.name}</p>
                {c.address && <p className="text-[13px] text-slate-600">{c.address}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {/* Shown so two same-named properties can be told apart before choosing — never
                      stored, and never presented as this hotel's rating until it IS this hotel. */}
                  {typeof c.rating === "number" && (
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-700">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {c.rating}
                      {typeof c.userRatingCount === "number" && (
                        <span className="font-medium text-slate-500">({c.userRatingCount})</span>
                      )}
                    </span>
                  )}
                  {c.mapsUri && (
                    <a
                      href={c.mapsUri}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[13px] font-bold text-blue-700 hover:underline"
                    >
                      <ExternalLink size={12} /> View on Maps
                    </a>
                  )}
                </div>
                <Btn size="sm" className="mt-2.5 w-full sm:w-auto" onClick={() => choose(c)}
                  disabled={disabled}>
                  This is my hotel
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
