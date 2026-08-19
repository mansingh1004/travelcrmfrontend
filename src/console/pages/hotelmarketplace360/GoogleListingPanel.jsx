// src/console/pages/hotelmarketplace360/GoogleListingPanel.jsx
//
// Links one catalog hotel to its Google listing, so its live rating and reviews appear on every
// tenant's page for it.
//
// WHY AN OPERATOR PICKS INSTEAD OF THE SERVER MATCHING. A wrong place id does not fail. It succeeds,
// and puts a DIFFERENT property's reviews and star rating on this hotel's page, where they read as
// genuine to every agent and every agent's customer. Half this catalog is "<place> Resort" or
// "<deity> Grand"; an automatic best-match would be right most of the time and silently wrong the
// rest, with no symptom until someone complained about a hotel they never stayed at.
//
// So: search offers candidates with their address and rating — the things that tell two same-named
// properties apart — and nothing is stored until a human chooses one.
//
// WHAT GETS STORED: the place id, and only the place id. Google's terms allow that indefinitely and
// allow the rating and review text only in a short-lived cache, which is why there is no reviews
// table anywhere in this codebase.

import { useState } from "react";
import { ExternalLink, Loader2, Search, Star, Unlink } from "lucide-react";
import { platformHotelService } from "../../api/platformHotelService";
import { useStepUp } from "../../components/useStepUp";
import { Button, Input, SectionCard } from "../../components/hotelUi";
import { getErrorMessage, isAlreadyReported } from "@shared/api/apiError";
import { useToast } from "@shared/ui/toast";

export default function GoogleListingPanel({ hotel, publicId, onChanged }) {
  const { showToast } = useToast();
  const stepUp = useStepUp();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);   // null = never searched, [] = searched, nothing found
  const [searching, setSearching] = useState(false);

  const linked = Boolean(hotel?.googlePlaceId);

  const search = async () => {
    setSearching(true);
    try {
      // Blank query is intentional and normal: the server defaults it to this hotel's own name and
      // address, which is what an operator would have typed anyway.
      setResults(await platformHotelService.searchGoogle(publicId, query.trim() || undefined));
    } catch (e) {
      if (!isAlreadyReported(e)) showToast(getErrorMessage(e, "Could not search Google."), "error");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const bind = (candidate) => stepUp.request({
    title: "Confirm Google listing",
    description:
      `This hotel's page will show the rating and reviews of "${candidate.name}". Every tenant sees them.`,
    confirmLabel: "Link listing",
    run: async (mfaCode) => {
      await platformHotelService.bindGoogle(publicId, candidate.placeId, mfaCode);
      setResults(null);
      setQuery("");
      onChanged?.();
      showToast("Google listing linked.", "success");
    },
  });

  const unbind = () => stepUp.request({
    title: "Remove the Google listing",
    description: "The rating and reviews stop showing on this hotel's page for every tenant.",
    confirmLabel: "Unlink",
    run: async (mfaCode) => {
      await platformHotelService.bindGoogle(publicId, "", mfaCode);
      onChanged?.();
      showToast("Google listing removed.", "success");
    },
  });

  return (
    <SectionCard
      title="Google listing"
      subtitle="Powers the live rating and review strip on every tenant's page for this hotel"
      icon={Star}
    >
      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-heading">Linked</p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted">{hotel.googlePlaceId}</p>
          </div>
          <Button variant="outline" size="sm" disabled={stepUp.busy} onClick={unbind}>
            <Unlink className="h-3.5 w-3.5" /> Unlink
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Not linked. Without a listing this hotel shows no rating and no reviews — which is the
          correct, silent outcome rather than an empty five-star row.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder={hotel?.name ? `Defaults to "${hotel.name}, ${hotel.cityName ?? ""}"` : "Search Google…"}
          className="min-w-[16rem] flex-1"
          disabled={searching || stepUp.busy}
        />
        <Button onClick={search} disabled={searching || stepUp.busy}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {linked ? "Search again" : "Find on Google"}
        </Button>
      </div>

      {/*
        An empty result is a real answer and gets said in words. It has three quite different causes
        and the operator can act on each — so it names them rather than showing a blank list.
      */}
      {results?.length === 0 && !searching && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted">
          No listings came back. Either Google does not know this property, or the Places integration
          is switched off on this server (<span className="font-mono">app.google.places.enabled</span>).
        </p>
      )}

      {results?.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {results.map((c) => (
            <li key={c.placeId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-heading">{c.name}</p>
                {/* The disambiguator. Two hotels share a name far more often than a street. */}
                {c.address && <p className="truncate text-xs text-muted">{c.address}</p>}
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  {c.rating != null && (
                    <span className="inline-flex items-center gap-1 text-hue-amber">
                      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                      {c.rating}
                      {c.userRatingCount != null && ` (${c.userRatingCount})`}
                    </span>
                  )}
                  {c.mapsUri && (
                    <a
                      href={c.mapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
                    >
                      Open on Google <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              </div>
              <Button size="sm" disabled={stepUp.busy} onClick={() => bind(c)}>
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}

      {stepUp.dialog}
    </SectionCard>
  );
}
