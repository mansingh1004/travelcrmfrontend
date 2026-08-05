// src/features/marketplace/pages/MarketplaceHotel.jsx
//
// Read-only detail of one catalog hotel, plus the two things a tenant may do with it: import a copy
// into its own Hotel Master, and send a booking request to the platform.
//
// No prices are rendered anywhere, because the catalog carries none — rooms and meal plans are
// descriptive, and rates live on a dated calendar this release does not ship. The amount a tenant
// will owe is set by the platform at approval time.

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BedDouble, Building2, Check, Download, ExternalLink, Globe, MapPin, Send, Star, UtensilsCrossed,
} from "lucide-react";
import { hasPermission, P } from "@shared/lib/access";
import { marketplaceService } from "../api/marketplaceService";
import {
  BackLink, Button, Card, Empty, Loading, Notice, Page, PageHeader, SectionLabel,
  errMsg, useToast,
} from "../components/marketplaceUi";

export function MarketplaceHotel() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);   // {tone, text} — a sticky version of the import result

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHotel(await marketplaceService.getHotel(publicId));
    } catch (e) {
      showToast(errMsg(e, "Could not load this hotel."), "error");
    } finally {
      setLoading(false);
    }
  }, [publicId, showToast]);

  useEffect(() => { load(); }, [load]);

  const runImport = async () => {
    setImporting(true);
    setNotice(null);
    try {
      const result = await marketplaceService.importHotel(publicId);
      showToast(
        result.created ? `${result.name} added to your hotels.` : `${result.name} refreshed.`,
        "success",
      );
      // LOCATION_MAPPING_REQUIRED is a *successful* import that could not be placed in the tenant's
      // geography. The message names the exact country/city to create, so it is pinned to the page
      // rather than left to a toast the user may miss.
      if (result.message) setNotice({ tone: "warn", text: result.message });
      await load();
    } catch (e) {
      // A 409 here is the expected "your masters are missing this city" answer, and the shared
      // interceptor stays silent on 409 by design — so the call site has to show it.
      setNotice({ tone: "error", text: errMsg(e, "Could not import this hotel.") });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <Page><Loading label="Loading hotel…" /></Page>;

  if (!hotel) {
    return (
      <Page>
        <Empty
          icon={Building2}
          title="Hotel not available"
          hint="It may have been withdrawn from Platform Hotel."
          action={<Button onClick={() => navigate("/marketplace")}>Back to Platform Hotel</Button>}
        />
      </Page>
    );
  }

  const location = [hotel.cityName, hotel.stateName, hotel.countryCode].filter(Boolean).join(", ");

  return (
    <Page>
      <PageHeader
        back={<BackLink onClick={() => navigate("/marketplace")}>Platform Hotel</BackLink>}
        title={
          <span className="inline-flex items-center gap-2">
            {hotel.name}
            {hotel.stars ? (
              <span className="inline-flex items-center gap-0.5 text-sm font-normal text-amber-600">
                <Star className="h-3.5 w-3.5 fill-current" />{hotel.stars}
              </span>
            ) : null}
          </span>
        }
        subtitle={location}
        actions={
          <>
            {hotel.alreadyImported ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
                <Check className="h-3.5 w-3.5" /> In your hotels
              </span>
            ) : (
              <Button onClick={runImport} loading={importing}>
                {!importing && <Download />}
                {importing ? "Importing…" : "Import to my hotels"}
              </Button>
            )}
            {/* Requesting is independent of importing: a tenant can book through the platform without
                holding a copy in its own master, and approval creates the projection anyway. Gated on
                BOOK — importing only needs SYNC_MASTER. */}
            {hasPermission(P.HOTEL_MARKETPLACE_BOOK) && (
              <Button variant="primary" onClick={() => navigate(`/marketplace/${publicId}/request`)}>
                <Send /> Request booking
              </Button>
            )}
          </>
        }
      />

      {hotel.primaryImageUrl && (
        <img
          src={hotel.primaryImageUrl}
          alt={hotel.name}
          className="mb-6 h-64 w-full rounded-lg border border-slate-200 object-cover"
        />
      )}

      {notice && <Notice tone={notice.tone} className="mb-6">{notice.text}</Notice>}

      {hotel.address && (
        <p className="mb-6 flex items-start gap-1.5 text-[13px] text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {hotel.address}
        </p>
      )}

      {hotel.overview && (
        <>
          <SectionLabel>About</SectionLabel>
          <p className="mb-8 text-sm leading-relaxed text-slate-600">{hotel.overview}</p>
        </>
      )}

      {(hotel.amenities ?? []).length > 0 && (
        <>
          <SectionLabel>Amenities</SectionLabel>
          <div className="mb-8 flex flex-wrap gap-1.5">
            {hotel.amenities.map((a) => (
              <span key={a} className="rounded border border-slate-200 px-2 py-0.5 text-[13px] text-slate-600">
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      <SectionLabel>
        <span className="inline-flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> Room types</span>
      </SectionLabel>
      <Card flush className="mb-8">
        {(hotel.rooms ?? []).length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-slate-400">No room types listed.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hotel.rooms.map((r) => (
              <li key={r.publicId} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{r.name}</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {[
                    r.maxOccupancy != null ? `Sleeps ${r.maxOccupancy}` : null,
                    r.bedType || null,
                    r.size || null,
                  ].filter(Boolean).join(" · ") || "—"}
                </p>
                {r.description && <p className="mt-1 text-[13px] text-slate-500">{r.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(hotel.mealPlans ?? []).length > 0 && (
        <>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5" /> Meal plans</span>
          </SectionLabel>
          <Card flush className="mb-8">
            <ul className="divide-y divide-slate-100">
              {hotel.mealPlans.map((m) => (
                <li key={m.publicId} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {m.code}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    {m.description && <p className="text-[13px] text-slate-500">{m.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {(hotel.website || hotel.mapUrl) && (
        <>
          <SectionLabel><span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Links</span></SectionLabel>
          <div className="flex flex-wrap gap-4">
            {hotel.website && <ExternalLinkRow href={hotel.website} label="Website" />}
            {hotel.mapUrl && <ExternalLinkRow href={hotel.mapUrl} label="Map" />}
          </div>
        </>
      )}
    </Page>
  );
}

function ExternalLinkRow({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] text-slate-900 underline-offset-2 hover:underline"
    >
      {label} <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
    </a>
  );
}

export default MarketplaceHotel;
