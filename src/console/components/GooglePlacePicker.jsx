// src/console/components/GooglePlacePicker.jsx
//
// Picks a Google listing for a hotel that has not been saved yet.
//
// The 360 screen's GoogleListingPanel binds a listing to an EXISTING hotel through its own endpoint.
// This is the create-form half: no publicId, nothing stored, so it searches freeform from whatever
// the form has typed and hands the chosen place id back to the form to submit with everything else.
//
// WHY BOTH EXIST rather than one component. They differ in the two things that matter — where the
// query comes from (the saved hotel vs the live form) and what "choose" means (a step-upped write vs
// a value in a payload). Sharing them would mean a component that takes a publicId OR a form, and a
// mode flag deciding whether it writes to the server, which is two components wearing one name.
//
// WHAT IT NEVER DOES: guess. No auto-select of the first result, however confident the match looks.
// A wrong place id does not fail — it puts another property's reviews and star rating on this
// hotel's page, where they read as genuine to every agent and their customers.

import { useState } from "react";
import { Check, ExternalLink, Loader2, Search, Star, X } from "lucide-react";
import { platformHotelService } from "../api/platformHotelService";
import { Button, Input, Label } from "./hotelUi";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

/**
 * @param {object}   props
 * @param {string}   props.value     the chosen place id, or "" — lives in the parent's form state
 * @param {Function} props.onChange  `(placeId) => void`
 * @param {object}   props.form      the live hotel form, for the default query and the map bias
 */
export default function GooglePlacePicker({ value, onChange, form }) {
  const { showToast } = useToast();
  const [results, setResults] = useState(null);   // null = never searched; [] = searched, none found
  const [searching, setSearching] = useState(false);

  const defaultQuery = [form?.name, form?.address, form?.cityName, form?.stateName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const [query, setQuery] = useState("");

  const search = async () => {
    const q = (query.trim() || defaultQuery).trim();
    if (!q) {
      showToast("Type the hotel's name first, then search.", "warning");
      return;
    }
    setSearching(true);
    try {
      setResults(await platformHotelService.searchGoogleFreeform({
        q,
        // The form's own coordinates, when it has them. A bias, never a filter — a hotel whose typed
        // position is a few kilometres out must not have its correct listing hidden.
        lat: form?.latitude === "" ? undefined : form?.latitude,
        lng: form?.longitude === "" ? undefined : form?.longitude,
      }));
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not search Google."), "error");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Google listing</Label>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-hover/50 px-3 py-2">
          <Check className="h-4 w-4 shrink-0 text-hue-emerald" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-body">{value}</span>
          <Button size="sm" variant="ghost" onClick={() => { onChange(""); setResults(null); }}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Optional. Links this property to its Google listing so its live rating and reviews show on
          every tenant&apos;s page. Leave it empty and no review strip appears — which is the correct
          silence, not a gap.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder={defaultQuery ? `Defaults to "${defaultQuery}"` : "Hotel name and city…"}
          className="min-w-[14rem] flex-1"
          disabled={searching}
        />
        <Button variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find on Google
        </Button>
      </div>

      {results?.length === 0 && !searching && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
          Nothing came back. Either Google does not know this property, or the Places integration is
          switched off on this server (<span className="font-mono">app.google.places.enabled</span>).
        </p>
      )}

      {results?.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {results.map((c) => (
            <li key={c.placeId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-heading">{c.name}</p>
                {/* The address is what tells two same-named properties apart, which is the entire
                    reason a human is choosing rather than the server matching. */}
                {c.address && <p className="truncate text-xs text-muted">{c.address}</p>}
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  {c.rating != null && (
                    <span className="inline-flex items-center gap-1 text-hue-amber">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                      {c.rating}{c.userRatingCount != null && ` (${c.userRatingCount})`}
                    </span>
                  )}
                  {c.mapsUri && (
                    <a
                      href={c.mapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              </div>
              <Button size="sm" onClick={() => { onChange(c.placeId); setResults(null); }}>
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
