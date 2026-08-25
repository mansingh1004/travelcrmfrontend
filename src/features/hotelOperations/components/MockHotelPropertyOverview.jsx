import { Building2, ChevronRight, MapPin, RotateCcw } from "lucide-react";

const COLUMNS = "minmax(130px,.8fr) minmax(230px,1.5fr) repeat(6,minmax(74px,.5fr)) 72px";

export default function MockHotelPropertyOverview({
  groups,
  loading,
  selectedBrandId,
  selectedHotelId,
  onSelectBrand,
  onSelectHotel,
  onClear,
}) {
  const filtered = Boolean(selectedBrandId || selectedHotelId);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Location → Hotel / Property → Bookings</h2>
          <p className="mt-1 text-xs text-slate-500">Mock-only property roll-up. Select a brand or one physical property to inspect its bookings.</p>
        </div>
        {filtered && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Show all properties
          </button>
        )}
      </header>

      {loading ? <OverviewSkeleton /> : (
        <div className="divide-y divide-slate-200">
          {groups.map((group) => (
            <BrandGroup
              key={group.brandId}
              group={group}
              selectedBrandId={selectedBrandId}
              selectedHotelId={selectedHotelId}
              onSelectBrand={onSelectBrand}
              onSelectHotel={onSelectHotel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BrandGroup({ group, selectedBrandId, selectedHotelId, onSelectBrand, onSelectHotel }) {
  const brandActive = selectedBrandId === group.brandId && !selectedHotelId;

  return (
    <article className={brandActive ? "bg-blue-50/30" : "bg-white"}>
      <button
        type="button"
        onClick={() => onSelectBrand(group.brandId)}
        aria-pressed={brandActive}
        className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition sm:px-5 ${
          brandActive ? "bg-blue-50" : "bg-slate-50/70 hover:bg-slate-100"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${brandActive ? "bg-blue-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
            <Building2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-slate-900">{group.brandName}</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              {group.totalBookings} bookings across {group.properties.length} {group.properties.length === 1 ? "property" : "properties"}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
          <StatChip value={group.totalGuests} label="guests" />
          <StatChip value={group.totalRooms} label="rooms" />
          <StatChip value={group.todayCheckIns} label="arrivals" tone="green" />
          <ChevronRight className="ml-1 h-4 w-4 text-slate-400" />
        </span>
      </button>

      <div className="divide-y divide-slate-100">
        <div className="hidden items-center gap-0 bg-white px-5 py-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-slate-400 md:grid" style={{ gridTemplateColumns: COLUMNS }}>
          <span>Location</span>
          <span>Hotel / Property</span>
          <span className="text-center">Bookings</span>
          <span className="text-center">Guests</span>
          <span className="text-center">Rooms</span>
          <span className="text-center">Today in</span>
          <span className="text-center">Today out</span>
          <span className="text-center">Pending</span>
          <span />
        </div>

        {group.properties.map((property) => {
          const active = selectedHotelId === property.hotelPublicId;
          return (
            <button
              key={property.hotelPublicId}
              type="button"
              onClick={() => onSelectHotel(group.brandId, property.hotelPublicId)}
              aria-pressed={active}
              className={`block w-full px-4 py-3.5 text-left transition sm:px-5 ${
                active ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-blue-50/40"
              }`}
            >
              <div className="hidden items-center gap-0 md:grid" style={{ gridTemplateColumns: COLUMNS }}>
                <LocationName value={property.locationName} />
                <PropertyName property={property} active={active} />
                <NumberCell value={property.totalBookings} />
                <NumberCell value={property.totalGuests} />
                <NumberCell value={property.totalRooms} />
                <NumberCell value={property.todayCheckIns} tone="green" />
                <NumberCell value={property.todayCheckOuts} tone="blue" />
                <NumberCell value={property.pendingConfirmations} tone="amber" />
                <span className="flex justify-end"><ChevronRight className="h-4 w-4 text-slate-300" /></span>
              </div>

              <div className="md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-extrabold ${active ? "text-blue-800" : "text-slate-900"}`}>{property.hotelName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <MapPin className="h-3 w-3" /> {property.locationName}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5">
                  <MobileMetric label="Bookings" value={property.totalBookings} />
                  <MobileMetric label="Guests" value={property.totalGuests} />
                  <MobileMetric label="Rooms" value={property.totalRooms} />
                  <MobileMetric label="Today in" value={property.todayCheckIns} />
                  <MobileMetric label="Today out" value={property.todayCheckOuts} />
                  <MobileMetric label="Pending" value={property.pendingConfirmations} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function LocationName({ value }) {
  return <span className="flex min-w-0 items-center gap-1.5 pr-3 text-xs font-bold text-slate-700"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{value}</span></span>;
}

function PropertyName({ property, active }) {
  return (
    <span className="min-w-0 pr-3">
      <span className={`block truncate text-xs font-extrabold ${active ? "text-blue-800" : "text-slate-900"}`}>{property.hotelName}</span>
      <span className="mt-0.5 block truncate text-[10px] text-slate-400">{property.address}</span>
    </span>
  );
}

function NumberCell({ value, tone = "slate" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "blue" ? "text-blue-700" : tone === "amber" ? "text-amber-700" : "text-slate-800";
  return <span className={`text-center text-xs font-extrabold tabular-nums ${color}`}>{value}</span>;
}

function StatChip({ value, label, tone = "slate" }) {
  const style = tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-600 ring-1 ring-slate-200";
  return <span className={`rounded-full px-2 py-1 ${style}`}>{value} {label}</span>;
}

function MobileMetric({ label, value }) {
  return <span className="text-center"><span className="block text-sm font-extrabold tabular-nums text-slate-800">{value}</span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span></span>;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-3 p-4 sm:p-5">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-slate-200 p-4">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-4 grid grid-cols-3 gap-3"><span className="h-10 rounded bg-slate-100" /><span className="h-10 rounded bg-slate-100" /><span className="h-10 rounded bg-slate-100" /></div>
        </div>
      ))}
    </div>
  );
}
