// src/features/hotels/pages/HotelDetails.jsx
// The showcase page — hero gallery + full property header + 10 tabs.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2, MapPin, BadgeInfo,
  IndianRupee, ExternalLink, Star, BedDouble, CalendarRange,
  Sparkles, ShieldCheck, Images, MessageSquareQuote, FileText, History, Gauge,
  Wifi, Waves, UtensilsCrossed, Dumbbell, Flower2, CircleParking, Plane, BellRing, Shirt, Wine, Snowflake, Coffee,
} from "lucide-react";
import hotelService from "../api/hotelService";
import {
  PageShell, FormHeader, GlassCard, SectionCard, Badge, Button, cn,
  LoadingState, EmptyState, useToast, errMsg,
  HOTEL_STATUS, ROOM_STATUS, BOOKING_STATUS, PAYMENT_STATUS, StatusBadge, StarRating,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  fmtMoney, fmtMoneyShort, fmtDate, fmtNumber, fmtPct,
} from "../components/hotelUi";
import { Gallery, InfoRow, Timeline } from "../components/hotelWidgets";

const AMENITY_ICONS = {
  wifi: Wifi, pool: Waves, restaurant: UtensilsCrossed, gym: Dumbbell, spa: Flower2,
  parking: CircleParking, airport: Plane, roomservice: BellRing, laundry: Shirt, bar: Wine,
  ac: Snowflake, breakfast: Coffee,
};
const AMENITY_LABEL = {
  wifi: "Free WiFi", pool: "Swimming Pool", restaurant: "Restaurant", gym: "Gym", spa: "Spa",
  parking: "Parking", airport: "Airport Transfer", roomservice: "Room Service", laundry: "Laundry",
  bar: "Bar", ac: "Air Conditioning", breakfast: "Breakfast",
};

const TABS = [
  { key: "overview", label: "Overview", icon: BadgeInfo },
  { key: "rooms", label: "Rooms & Rates", icon: BedDouble },
  { key: "inventory", label: "Inventory", icon: CalendarRange },
  { key: "bookings", label: "Bookings", icon: CalendarRange },
  { key: "amenities", label: "Amenities", icon: Sparkles },
  { key: "policies", label: "Policies", icon: ShieldCheck },
  { key: "photos", label: "Photos", icon: Images },
  { key: "reviews", label: "Reviews", icon: MessageSquareQuote },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "activity", label: "Activity Log", icon: History },
];

export default function HotelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hotel, setHotel] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([hotelService.getHotel(id), hotelService.listBookings(id)])
      .then(([h, b]) => { if (alive) { setHotel(h); setBookings(b); } })
      .catch((e) => alive && showToast(errMsg(e, "Failed to load hotel."), "error"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id, showToast]);

  if (loading) return <PageShell><LoadingState label="Loading hotel…" /></PageShell>;
  if (!hotel) return <PageShell><GlassCard><EmptyState icon={Building2} title="Hotel not found" /></GlassCard></PageShell>;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lng}`;
  const mapEmbed = `https://maps.google.com/maps?q=${hotel.lat},${hotel.lng}&z=13&output=embed`;

  return (
    <PageShell>
      <FormHeader
        backLabel="Back to hotels"
        onBack={() => navigate("/hotels")}
        icon={Building2}
        title={hotel.name}
        subtitle={`${hotel.code} · ${hotel.type} · ${hotel.chain}`}
        right={<StatusBadge config={HOTEL_STATUS} value={hotel.status} />}
      />

      {/* Hero: gallery + property header card */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Gallery images={hotel.images} alt={hotel.name} />
        </div>
        <GlassCard className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{hotel.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <StarRating value={hotel.rating} size={16} showValue />
                <span className="text-xs text-slate-400">({fmtNumber(hotel.reviewsCount)} reviews)</span>
              </div>
            </div>
          </div>
          <p className="mb-3 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0 text-blue-500" /> {hotel.address}
            <a href={mapUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-xs font-bold text-blue-600 hover:underline">
              Map <ExternalLink className="h-3 w-3" />
            </a>
          </p>

          <div className="divide-y divide-slate-100">
            <InfoRow label="Hotel Code" value={hotel.code} />
            <InfoRow label="Hotel Type" value={hotel.type} />
            <InfoRow label="Hotel Chain" value={hotel.chain} />
            <InfoRow label="Website" value={<a href={`https://${hotel.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{hotel.website}</a>} />
            <InfoRow label="GST Number" value={hotel.gst} />
            <InfoRow label="Currency" value={hotel.currency} />
            <InfoRow label="Phone" value={hotel.phone} />
            <InfoRow label="Email" value={hotel.email} />
            <InfoRow label="Check-in" value={hotel.checkIn} />
            <InfoRow label="Check-out" value={hotel.checkOut} />
            <InfoRow label="Owner" value={hotel.owner} />
            <InfoRow label="Contact Person" value={hotel.contactPerson} />
          </div>
        </GlassCard>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={Gauge} label="Occupancy" value={fmtPct(hotel.occupancy)} tone="text-amber-500" bg="bg-amber-50" />
        <MiniStat icon={CalendarRange} label="Today's Bookings" value={hotel.todaysBookings} tone="text-blue-500" bg="bg-blue-50" />
        <MiniStat icon={IndianRupee} label="Revenue / mo" value={fmtMoneyShort(hotel.revenueMonth)} tone="text-emerald-500" bg="bg-emerald-50" />
        <MiniStat icon={BedDouble} label="Available Rooms" value={hotel.availableRooms} tone="text-green-500" bg="bg-green-50" />
      </div>

      {/* Tabs */}
      <div className="mb-4 overflow-x-auto">
        <div className="inline-flex gap-1 rounded-2xl border border-slate-100 bg-white/70 p-1 backdrop-blur">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all",
                  active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hfade-up">
        {tab === "overview" && <OverviewTab hotel={hotel} mapEmbed={mapEmbed} />}
        {tab === "rooms" && <RoomsTab rooms={hotel.roomTypes} />}
        {tab === "inventory" && <InventoryTab hotel={hotel} navigate={navigate} />}
        {tab === "bookings" && <BookingsTab bookings={bookings} />}
        {tab === "amenities" && <AmenitiesTab amenities={hotel.amenities} />}
        {tab === "policies" && <PoliciesTab hotel={hotel} />}
        {tab === "photos" && <PhotosTab images={hotel.images} />}
        {tab === "reviews" && <ReviewsTab hotel={hotel} />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "activity" && <ActivityTab hotel={hotel} />}
      </div>
    </PageShell>
  );
}

function MiniStat({ icon: Icon, label, value, tone, bg }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg)}>
          <Icon className={cn("h-5 w-5", tone)} />
        </div>
        <div>
          <p className="text-lg font-extrabold text-slate-800">{value}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        </div>
      </div>
    </GlassCard>
  );
}

/* ── Tabs ─────────────────────────────────────────────────── */
function OverviewTab({ hotel, mapEmbed }) {
  const top = hotel.amenities.slice(0, 10);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="About Hotel" icon={BadgeInfo}>
          <p className="text-sm leading-relaxed text-slate-600">{hotel.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Year Built" value={hotel.yearBuilt} />
            <Fact label="Renovated" value={hotel.renovated} />
            <Fact label="Total Rooms" value={hotel.totalRooms} />
            <Fact label="Total Floors" value={hotel.floors} />
          </div>
        </SectionCard>

        <SectionCard title="Top Amenities" icon={Sparkles}>
          <div className="flex flex-wrap gap-2">
            {top.map((a) => {
              const Icon = AMENITY_ICONS[a] || Sparkles;
              return (
                <span key={a} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600">
                  <Icon className="h-4 w-4 text-blue-500" /> {AMENITY_LABEL[a] || a}
                </span>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="Location" icon={MapPin} bodyClass="p-0">
          <iframe title="map" src={mapEmbed} className="h-56 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="p-4">
            <p className="text-sm font-semibold text-slate-600">{hotel.address}</p>
            <p className="text-xs text-slate-400">{hotel.city}, {hotel.state}</p>
          </div>
        </SectionCard>

        <SectionCard title="Hotel Statistics" icon={Gauge}>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Occupancy" value={fmtPct(hotel.occupancy)} tone="text-amber-600" bg="bg-amber-50" />
            <StatBox label="Today's Bookings" value={hotel.todaysBookings} tone="text-blue-600" bg="bg-blue-50" />
            <StatBox label="Revenue" value={fmtMoneyShort(hotel.revenueToday)} tone="text-emerald-600" bg="bg-emerald-50" />
            <StatBox label="Available Rooms" value={hotel.availableRooms} tone="text-green-600" bg="bg-green-50" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function RoomsTab({ rooms }) {
  return (
    <GlassCard className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Room</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Base Price</TableHead>
            <TableHead>Extra Adult</TableHead>
            <TableHead>Extra Child</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Booked</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <img src={r.image} alt="" className="h-10 w-14 rounded-lg object-cover" loading="lazy" />
                  <span className="font-bold text-slate-700">{r.name}</span>
                </div>
              </TableCell>
              <TableCell>{r.capacity} guests</TableCell>
              <TableCell className="font-bold text-slate-700">{fmtMoney(r.basePrice)}</TableCell>
              <TableCell>{fmtMoney(r.extraAdult)}</TableCell>
              <TableCell>{fmtMoney(r.extraChild)}</TableCell>
              <TableCell><Badge variant="green">{r.available}</Badge></TableCell>
              <TableCell><Badge variant="blue">{r.booked}</Badge></TableCell>
              <TableCell><StatusBadge config={ROOM_STATUS} value={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

function InventoryTab({ hotel, navigate }) {
  return (
    <SectionCard title="Inventory snapshot" subtitle="Availability by room type" icon={CalendarRange}
      right={<Button variant="outline" size="sm" onClick={() => navigate(`/hotels/inventory?hotel=${hotel.id}`)}>Open Calendar</Button>}>
      <div className="space-y-3">
        {hotel.roomTypes.map((rt) => {
          const pct = Math.round((rt.booked / rt.total) * 100);
          const tone = pct >= 100 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-green-500";
          return (
            <div key={rt.id} className="rounded-xl border border-slate-100 bg-white/60 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{rt.name}</span>
                <span className="text-xs font-semibold text-slate-500">{rt.available}/{rt.total} available</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function BookingsTab({ bookings }) {
  if (!bookings.length) return <GlassCard><EmptyState icon={CalendarRange} title="No bookings yet" /></GlassCard>;
  return (
    <GlassCard className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking ID</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.slice(0, 12).map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-bold text-blue-600">{b.id}</TableCell>
              <TableCell>{b.guest}</TableCell>
              <TableCell>{b.room}</TableCell>
              <TableCell>{fmtDate(b.checkIn)}</TableCell>
              <TableCell>{fmtDate(b.checkOut)}</TableCell>
              <TableCell><StatusBadge config={PAYMENT_STATUS} value={b.paymentStatus} /></TableCell>
              <TableCell><StatusBadge config={BOOKING_STATUS} value={b.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

function AmenitiesTab({ amenities }) {
  const all = Object.keys(AMENITY_LABEL);
  return (
    <SectionCard title="Amenities & Facilities" icon={Sparkles}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {all.map((a) => {
          const has = amenities.includes(a);
          const Icon = AMENITY_ICONS[a] || Sparkles;
          return (
            <div key={a} className={cn("flex items-center gap-2.5 rounded-xl border p-3",
              has ? "border-blue-100 bg-blue-50/40" : "border-slate-100 bg-slate-50/40 opacity-55")}>
              <Icon className={cn("h-5 w-5", has ? "text-blue-600" : "text-slate-400")} />
              <span className={cn("text-[13px] font-semibold", has ? "text-slate-700" : "text-slate-400 line-through")}>{AMENITY_LABEL[a]}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function PoliciesTab({ hotel }) {
  const policies = [
    { title: "Check-in / Check-out", body: `Check-in from ${hotel.checkIn}, check-out by ${hotel.checkOut}. Early check-in subject to availability.` },
    { title: "Cancellation", body: "Free cancellation up to 48 hours before arrival. 1 night charge for late cancellation; no-shows charged in full." },
    { title: "Children & Extra Beds", body: "Children below 6 stay free. Extra adult and child charges apply per room type as listed under Rooms & Rates." },
    { title: "Payment", body: "We accept UPI, all major cards and bank transfer. GST invoice provided on checkout." },
    { title: "Pets", body: "Pets are not allowed, except registered service animals." },
    { title: "ID Proof", body: "A valid government photo ID is mandatory at check-in for all guests." },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {policies.map((p) => (
        <SectionCard key={p.title} title={p.title} icon={ShieldCheck}>
          <p className="text-sm leading-relaxed text-slate-600">{p.body}</p>
        </SectionCard>
      ))}
    </div>
  );
}

function PhotosTab({ images }) {
  return (
    <SectionCard title="Photo Gallery" icon={Images}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <div key={i} className="group overflow-hidden rounded-xl bg-slate-100">
            <img src={src} alt={`Photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ReviewsTab({ hotel }) {
  const buckets = [5, 4, 3, 2, 1];
  const dist = { 5: 62, 4: 24, 3: 8, 2: 4, 1: 2 };
  const reviews = [
    { name: "Ananya S.", rating: 5, text: "Stunning property, spotless rooms and the staff went above and beyond. The sea-view suite was worth every rupee." },
    { name: "Rohan M.", rating: 4, text: "Great location and breakfast spread. Check-in was a touch slow but the room made up for it." },
    { name: "Priya K.", rating: 5, text: "Best spa experience in the city. Will definitely be back for our anniversary." },
    { name: "Kabir V.", rating: 4, text: "Comfortable stay, good value. Pool could be a little bigger but overall a lovely weekend." },
  ];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <SectionCard title="Rating Summary" icon={Star}>
        <div className="mb-4 text-center">
          <p className="text-4xl font-extrabold text-slate-800">{hotel.rating.toFixed(1)}</p>
          <div className="mt-1 flex justify-center"><StarRating value={hotel.rating} size={18} /></div>
          <p className="mt-1 text-xs text-slate-400">{fmtNumber(hotel.reviewsCount)} reviews</p>
        </div>
        <div className="space-y-2">
          {buckets.map((b) => (
            <div key={b} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-bold text-slate-500">{b}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${dist[b]}%` }} />
              </div>
              <span className="w-8 text-right font-semibold text-slate-400">{dist[b]}%</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-4 lg:col-span-2">
        {reviews.map((r, i) => (
          <GlassCard key={i} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">{r.name[0]}</span>
                <span className="font-bold text-slate-700">{r.name}</span>
              </div>
              <StarRating value={r.rating} size={14} />
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{r.text}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab() {
  const docs = [
    { name: "Trade License.pdf", size: "1.2 MB", date: "2026-01-12" },
    { name: "GST Registration.pdf", size: "820 KB", date: "2025-11-03" },
    { name: "Fire Safety Certificate.pdf", size: "2.1 MB", date: "2026-03-22" },
    { name: "Property Insurance.pdf", size: "1.7 MB", date: "2026-02-15" },
  ];
  return (
    <GlassCard className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow><TableHead>Document</TableHead><TableHead>Size</TableHead><TableHead>Uploaded</TableHead><TableHead /></TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.name}>
              <TableCell><span className="flex items-center gap-2 font-semibold text-slate-700"><FileText className="h-4 w-4 text-blue-500" />{d.name}</span></TableCell>
              <TableCell>{d.size}</TableCell>
              <TableCell>{fmtDate(d.date)}</TableCell>
              <TableCell><Button variant="ghost" size="sm">Download</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

function ActivityTab({ hotel }) {
  const steps = [
    { title: "Rate updated — Deluxe Room", detail: "Weekend price set to ₹4,999", time: "2h ago", tone: "blue" },
    { title: "New booking BKG-20517", detail: "2 nights · Sea View", time: "5h ago", tone: "green" },
    { title: "Inventory synced with Booking.com", detail: "12 rooms updated", time: "Yesterday", tone: "indigo" },
    { title: "Housekeeping report filed", detail: "18 rooms inspected", time: "Yesterday", tone: "teal" },
    { title: "Photos updated", detail: `${hotel.images.length} images in gallery`, time: "2 days ago", tone: "purple" },
    { title: "Property details edited", detail: "Contact person changed", time: "3 days ago", tone: "slate" },
  ];
  return (
    <SectionCard title="Activity Log" icon={History}>
      <Timeline steps={steps} />
    </SectionCard>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-lg font-extrabold text-slate-800">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
function StatBox({ label, value, tone, bg }) {
  return (
    <div className={cn("rounded-xl p-3", bg)}>
      <p className={cn("text-lg font-extrabold", tone)}>{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
