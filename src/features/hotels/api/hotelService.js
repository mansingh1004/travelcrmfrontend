// src/features/hotels/api/hotelService.js
// ─────────────────────────────────────────────────────────────
// Data layer for the Hotel Management module.
//
// This is currently backed by an in-memory MOCK dataset so the UI is fully
// demonstrable with zero backend. Every page reads through the async getters
// below — no page hardcodes data — so swapping to the real API later means
// replacing the bodies of these functions with `API.get(...)` calls (the
// shared axios instance is already imported and ready), with NO page changes.
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
import API from "@shared/api/http"; // ready for the real backend; mock getters below don't use it yet

/* ── Deterministic pseudo-random (stable across reloads, no Math.random flicker) ── */
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rnd = seeded(20260718);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (min, max) => Math.floor(min + rnd() * (max - min + 1));

/* ── Static image pool (Unsplash — hotel/room imagery) ── */
const HOTEL_IMGS = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&q=80",
];
const ROOM_IMGS = [
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80",
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80",
];

const CITIES = [
  { city: "Goa", state: "Goa", lat: 15.2993, lng: 74.124 },
  { city: "Manali", state: "Himachal Pradesh", lat: 32.2432, lng: 77.1892 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "New Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { city: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125 },
];
const CHAINS = ["Taj Group", "Oberoi Hotels", "ITC Hotels", "Independent", "Marriott"];
const TYPES = ["Resort", "Business Hotel", "Boutique", "Heritage", "Beach Resort"];
const FIRST = ["Aarav", "Vivaan", "Aditya", "Ananya", "Diya", "Ishaan", "Kabir", "Meera", "Rohan", "Sara", "Priya", "Arjun"];
const LAST = ["Sharma", "Verma", "Patel", "Nair", "Reddy", "Gupta", "Singh", "Iyer", "Bose", "Mehta"];
const SOURCES = ["Website", "Booking.com", "Agoda", "MakeMyTrip", "Goibibo", "Travel Agent", "Walk-in"];

const AMENITY_CATALOG = [
  { key: "wifi", label: "Free WiFi", icon: "Wifi" },
  { key: "pool", label: "Swimming Pool", icon: "Waves" },
  { key: "restaurant", label: "Restaurant", icon: "UtensilsCrossed" },
  { key: "gym", label: "Gym", icon: "Dumbbell" },
  { key: "spa", label: "Spa", icon: "Flower2" },
  { key: "parking", label: "Parking", icon: "CircleParking" },
  { key: "airport", label: "Airport Transfer", icon: "Plane" },
  { key: "roomservice", label: "Room Service", icon: "BellRing" },
  { key: "laundry", label: "Laundry", icon: "Shirt" },
  { key: "bar", label: "Bar", icon: "Wine" },
  { key: "ac", label: "Air Conditioning", icon: "Snowflake" },
  { key: "breakfast", label: "Breakfast", icon: "Coffee" },
];

const ROOM_TYPE_NAMES = ["Deluxe Room", "Executive Suite", "Premium Sea View", "Standard Twin", "Presidential Suite", "Garden Villa"];

const money = (n) => Math.round(n);

/* ── Build the hotel dataset once (module-scope, stable) ── */
function buildHotels() {
  return Array.from({ length: 8 }).map((_, i) => {
    const loc = CITIES[i % CITIES.length];
    const totalRooms = between(40, 180);
    const availableRooms = between(5, totalRooms);
    const occupied = totalRooms - availableRooms;
    const rating = (3 + rnd() * 2);
    const roomTypes = buildRoomTypes(totalRooms);
    return {
      id: `HTL-${1001 + i}`,
      code: `HC${100 + i}`,
      name: `${pick(["Grand", "Royal", "The", "Sea", "Hill"])} ${loc.city} ${pick(["Palace", "Resort", "Retreat", "Residency", "Bay"])}`,
      status: pick(["ACTIVE", "ACTIVE", "ACTIVE", "MAINTENANCE"]),
      type: TYPES[i % TYPES.length],
      chain: CHAINS[i % CHAINS.length],
      rating: Math.round(rating * 10) / 10,
      reviewsCount: between(80, 1400),
      city: loc.city,
      state: loc.state,
      address: `${between(1, 99)} ${pick(["MG Road", "Beach Road", "Mall Road", "Ring Road"])}, ${loc.city}`,
      lat: loc.lat, lng: loc.lng,
      website: `www.${loc.city.toLowerCase().replace(/\s/g, "")}hotels.com`,
      gst: `27ABCDE${1000 + i}F1Z5`,
      currency: "INR",
      phone: `+91 ${between(70, 99)}${between(10000000, 99999999)}`,
      email: `reservations@${loc.city.toLowerCase().replace(/\s/g, "")}hotels.com`,
      checkIn: "14:00",
      checkOut: "11:00",
      owner: `${pick(FIRST)} ${pick(LAST)}`,
      contactPerson: `${pick(FIRST)} ${pick(LAST)}`,
      yearBuilt: between(1985, 2015),
      renovated: between(2018, 2024),
      floors: between(3, 14),
      totalRooms,
      availableRooms,
      occupiedRooms: occupied,
      occupancy: Math.round((occupied / totalRooms) * 100),
      revenueToday: money(between(80000, 900000)),
      revenueMonth: money(between(2500000, 28000000)),
      todaysBookings: between(2, 24),
      images: [HOTEL_IMGS[i % HOTEL_IMGS.length], ...HOTEL_IMGS.filter((_, j) => j !== i % HOTEL_IMGS.length).slice(0, 4)],
      amenities: AMENITY_CATALOG.filter(() => rnd() > 0.35).map((a) => a.key),
      description:
        "A landmark property blending contemporary comfort with regional character. Spacious rooms, curated dining, a full-service spa and event spaces make it a preferred choice for both leisure and business travellers.",
      roomTypes,
    };
  });
}

function buildRoomTypes() {
  const count = between(3, 5);
  return Array.from({ length: count }).map((_, i) => {
    const total = between(8, 40);
    const booked = between(0, total);
    const base = money(between(3500, 24000));
    return {
      id: `RT-${100 + i}-${between(10, 99)}`,
      name: ROOM_TYPE_NAMES[i % ROOM_TYPE_NAMES.length],
      image: ROOM_IMGS[i % ROOM_IMGS.length],
      capacity: between(2, 4),
      basePrice: base,
      extraAdult: money(base * 0.15),
      extraChild: money(base * 0.08),
      total,
      booked,
      available: total - booked,
      status: total - booked === 0 ? "SOLD_OUT" : "ACTIVE",
      // seasonal multipliers used by the Pricing page
      weekday: base,
      weekend: money(base * 1.25),
      peak: money(base * 1.6),
    };
  });
}

const HOTELS = buildHotels();

function buildBookings(hotel) {
  const src = hotel || pick(HOTELS);
  const n = between(14, 40);
  const today = new Date(2026, 6, 18);
  return Array.from({ length: n }).map((_, i) => {
    const ci = new Date(today);
    ci.setDate(today.getDate() + between(-6, 12));
    const nights = between(1, 6);
    const co = new Date(ci);
    co.setDate(ci.getDate() + nights);
    const rt = pick(src.roomTypes);
    const adults = between(1, 3);
    const children = between(0, 2);
    const amount = money(rt.basePrice * nights * (1 + rnd() * 0.2));
    return {
      id: `BKG-${20500 + i}`,
      hotelId: src.id,
      hotelName: src.name,
      guest: `${pick(FIRST)} ${pick(LAST)}`,
      guestPhone: `+91 ${between(70, 99)}${between(10000000, 99999999)}`,
      room: rt.name,
      roomNo: `${between(1, src.floors)}0${between(1, 9)}`,
      checkIn: ci.toISOString().slice(0, 10),
      checkOut: co.toISOString().slice(0, 10),
      nights,
      adults,
      children,
      amount,
      paidAmount: pick([amount, amount, money(amount * 0.5), 0]),
      paymentStatus: pick(["PAID", "PAID", "PENDING", "REFUNDED", "FAILED"]),
      status: pick(["CONFIRMED", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "PENDING", "CANCELLED"]),
      source: pick(SOURCES),
    };
  });
}

function delay(value, ms = 350) {
  return new Promise((res) => setTimeout(() => res(structuredCloneSafe(value)), ms));
}
function structuredCloneSafe(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC ASYNC GETTERS  (swap bodies for API.get(...) when backend is ready)
═══════════════════════════════════════════════════════════════ */
const hotelService = {
  // ── Hotels ────────────────────────────────────────────────
  listHotels() { return delay(HOTELS.map(stripHeavy)); },
  getHotel(id) { return delay(HOTELS.find((h) => h.id === id) || HOTELS[0]); },

  // ── Room types ────────────────────────────────────────────
  listRoomTypes(hotelId) {
    const h = HOTELS.find((x) => x.id === hotelId) || HOTELS[0];
    return delay(h.roomTypes.map((r) => ({ ...r, hotelId: h.id, hotelName: h.name })));
  },
  // Flat list across all hotels (Room Types / Pricing landing pages)
  allRoomTypes() {
    return delay(HOTELS.flatMap((h) => h.roomTypes.map((r) => ({ ...r, hotelId: h.id, hotelName: h.name }))));
  },

  // ── Bookings ──────────────────────────────────────────────
  listBookings(hotelId) {
    const h = hotelId ? HOTELS.find((x) => x.id === hotelId) : null;
    if (h) return delay(buildBookings(h));
    // all hotels
    return delay(HOTELS.flatMap((x) => buildBookings(x)).slice(0, 60));
  },

  // ── Inventory calendar ────────────────────────────────────
  inventory(hotelId, year, month) {
    const h = HOTELS.find((x) => x.id === hotelId) || HOTELS[0];
    const days = new Date(year, month + 1, 0).getDate();
    const grid = h.roomTypes.map((rt) => {
      const cells = Array.from({ length: days }).map((_, d) => {
        const total = rt.total;
        const sold = between(0, total);
        const ratio = sold / total;
        const state = ratio >= 1 ? "SOLD_OUT" : ratio >= 0.6 ? "PARTIAL" : "AVAILABLE";
        return { day: d + 1, total, sold, available: total - sold, state, price: rt.basePrice };
      });
      return { roomTypeId: rt.id, roomType: rt.name, total: rt.total, cells };
    });
    return delay({ hotelId: h.id, hotelName: h.name, year, month, days, grid });
  },

  // ── Amenities ─────────────────────────────────────────────
  amenityCatalog() { return delay(AMENITY_CATALOG); },

  // ── Housekeeping ──────────────────────────────────────────
  housekeeping(hotelId) {
    const h = HOTELS.find((x) => x.id === hotelId) || HOTELS[0];
    const rows = Array.from({ length: between(16, 30) }).map((_, i) => {
      const floor = between(1, h.floors);
      return {
        id: `HK-${i}`,
        roomNo: `${floor}${String(between(1, 20)).padStart(2, "0")}`,
        roomType: pick(h.roomTypes).name,
        status: pick(["READY", "CLEANING", "DIRTY", "INSPECTED", "MAINTENANCE"]),
        housekeeper: `${pick(FIRST)} ${pick(LAST)}`,
        eta: `${between(0, 1)}:${pick(["05", "15", "30", "45"])} hr`,
      };
    });
    return delay({ hotelId: h.id, hotelName: h.name, rows });
  },

  // ── Owner / group dashboard ───────────────────────────────
  dashboard() {
    const totalHotels = HOTELS.length;
    const totalRooms = HOTELS.reduce((s, h) => s + h.totalRooms, 0);
    const availableRooms = HOTELS.reduce((s, h) => s + h.availableRooms, 0);
    const occupiedRooms = totalRooms - availableRooms;
    const revenueToday = HOTELS.reduce((s, h) => s + h.revenueToday, 0);
    const revenueMonth = HOTELS.reduce((s, h) => s + h.revenueMonth, 0);
    const allBookings = HOTELS.flatMap((h) => buildBookings(h));

    const kpis = {
      totalHotels, totalRooms, availableRooms, occupiedRooms,
      checkinsToday: between(12, 48),
      checkoutsToday: between(10, 40),
      upcomingArrivals: between(20, 70),
      cancelled: allBookings.filter((b) => b.status === "CANCELLED").length,
      revenueToday, revenueMonth,
      occupancy: Math.round((occupiedRooms / totalRooms) * 100),
      avgRating: Math.round((HOTELS.reduce((s, h) => s + h.rating, 0) / totalHotels) * 10) / 10,
    };

    // Room status split (across group)
    const roomStatus = {
      AVAILABLE: availableRooms,
      OCCUPIED: occupiedRooms,
      CLEANING: between(10, 40),
      MAINTENANCE: between(4, 20),
      BLOCKED: between(2, 12),
    };

    // Booking sources breakdown
    const sourceCounts = SOURCES.map((s) => ({ source: s, value: allBookings.filter((b) => b.source === s).length + between(2, 20) }));

    // Payment status
    const payments = {
      PAID: allBookings.filter((b) => b.paymentStatus === "PAID").length,
      PENDING: allBookings.filter((b) => b.paymentStatus === "PENDING").length,
      REFUNDED: allBookings.filter((b) => b.paymentStatus === "REFUNDED").length,
      FAILED: allBookings.filter((b) => b.paymentStatus === "FAILED").length,
      totalCollection: money(revenueMonth * 0.82),
      outstanding: money(revenueMonth * 0.18),
    };

    // Revenue analytics — 14-day daily + 6-month monthly
    const dailyRevenue = Array.from({ length: 14 }).map((_, i) => ({
      label: `${18 - 13 + i}/07`,
      revenue: money(between(400000, 1600000)),
      occupancy: between(45, 95),
      adr: money(between(4200, 9800)),
      revpar: money(between(2600, 7200)),
    }));
    const monthlyRevenue = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m) => ({
      label: m,
      revenue: money(between(9000000, 32000000)),
    }));

    // Today's schedule (timeline cards)
    const schedule = [
      { time: "09:00", title: "Check-ins", detail: `${kpis.checkinsToday} guests arriving`, tone: "blue" },
      { time: "11:00", title: "Airport Pickup", detail: `${between(2, 8)} transfers scheduled`, tone: "indigo" },
      { time: "12:00", title: "Pending Payments", detail: `${payments.PENDING} to follow up`, tone: "amber" },
      { time: "14:00", title: "Guest Arrival", detail: "VIP suite — Presidential", tone: "purple" },
      { time: "18:00", title: "Special Requests", detail: `${between(3, 12)} open requests`, tone: "teal" },
      { time: "23:00", title: "Check-outs", detail: `${kpis.checkoutsToday} departures`, tone: "slate" },
    ];

    // Notifications feed
    const notifTypes = [
      { type: "New Booking", tone: "blue" },
      { type: "Payment Received", tone: "green" },
      { type: "Reminder Sent", tone: "indigo" },
      { type: "Refund Processed", tone: "purple" },
      { type: "Low Inventory Alert", tone: "amber" },
      { type: "Overbooking Alert", tone: "red" },
      { type: "Guest Message", tone: "teal" },
      { type: "Owner Notification", tone: "slate" },
    ];
    const notifications = notifTypes.map((n, i) => ({
      id: i,
      ...n,
      text: notifText(n.type),
      when: `${between(1, 58)} min ago`,
    }));

    // OTA channel manager
    const channels = ["Website", "Booking.com", "Agoda", "MakeMyTrip", "Goibibo"].map((c) => ({
      name: c,
      status: pick(["SYNCED", "SYNCED", "SYNCING", "ERROR"]),
      lastSync: `${between(2, 40)} min ago`,
    }));

    // Hotel performance ranking
    const performance = [...HOTELS]
      .map((h) => ({
        id: h.id, name: h.name, city: h.city, occupancy: h.occupancy,
        revenue: h.revenueMonth, rating: h.rating,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Live booking map (India cities)
    const map = CITIES.map((c) => ({ city: c.city, lat: c.lat, lng: c.lng, bookings: between(8, 60) }));

    // Upcoming reminders
    const reminders = {
      checkinsTomorrow: between(10, 40),
      whatsappPending: between(3, 18),
      emailPending: between(2, 14),
      smsPending: between(1, 9),
    };

    // AI insights
    const insights = [
      { title: "Weekend occupancy prediction", value: `${between(78, 96)}%`, note: "Sat–Sun, next weekend", tone: "blue", trend: "up" },
      { title: "Recommended room price", value: `₹${between(6, 12) * 1000}`, note: "Deluxe · dynamic pricing", tone: "green", trend: "up" },
      { title: "Rooms with low demand", value: `${between(2, 6)} types`, note: "Consider promo pricing", tone: "amber", trend: "down" },
      { title: "Rooms with high demand", value: `${between(2, 5)} types`, note: "Sea View, Suites", tone: "purple", trend: "up" },
      { title: "Revenue forecast (30d)", value: `₹${between(2, 4)}.${between(1, 9)}Cr`, note: "+12% vs last month", tone: "teal", trend: "up" },
      { title: "Cancellation prediction", value: `${between(4, 11)}%`, note: "Below industry avg", tone: "red", trend: "down" },
    ];

    // Check-in / check-out boards
    const checkinBoard = allBookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN")
      .slice(0, 8)
      .map((b) => ({ guest: b.guest, time: pick(["13:00", "14:30", "15:00", "16:45"]), room: b.roomNo, status: b.status }));
    const checkoutBoard = allBookings
      .filter((b) => b.status === "CHECKED_IN" || b.status === "CHECKED_OUT")
      .slice(0, 8)
      .map((b) => ({ guest: b.guest, room: b.roomNo, pending: Math.max(0, b.amount - b.paidAmount) }));

    return delay({
      kpis, roomStatus, sourceCounts, payments, dailyRevenue, monthlyRevenue,
      schedule, notifications, channels, performance, map, reminders, insights,
      checkinBoard, checkoutBoard,
    });
  },

  // ── Reports ───────────────────────────────────────────────
  reports() {
    const monthly = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m) => ({
      label: m,
      revenue: money(between(9000000, 30000000)),
      bookings: between(180, 640),
      adr: money(between(4200, 9200)),
      revpar: money(between(2400, 6800)),
      occupancy: between(48, 92),
    }));
    const bySource = SOURCES.map((s) => ({ source: s, value: between(40, 260) }));
    const byCity = CITIES.map((c) => ({ city: c.city, revenue: money(between(3000000, 22000000)) }));
    return delay({ monthly, bySource, byCity });
  },
};

function stripHeavy(h) {
  // list view keeps a light payload (description not needed on cards)
  const rest = { ...h };
  delete rest.description;
  return rest;
}

function notifText(type) {
  const map = {
    "New Booking": "BKG-20517 · Deluxe Room · 2 nights",
    "Payment Received": "₹18,400 received via UPI",
    "Reminder Sent": "WhatsApp reminder to 12 guests",
    "Refund Processed": "₹9,200 refunded — BKG-20488",
    "Low Inventory Alert": "Sea View Rooms · 2 left this weekend",
    "Overbooking Alert": "Standard Twin oversold by 1",
    "Guest Message": "“Early check-in possible?” — Room 402",
    "Owner Notification": "Monthly statement ready to download",
  };
  return map[type] || "";
}

export default hotelService;
export { AMENITY_CATALOG };
