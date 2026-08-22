// Explicit demo fixtures for Hotel Operations. These are never an API fallback: callers must opt
// in with `mock=1`, so a real backend failure can never be mistaken for healthy operational data.

const pad = (value) => String(value).padStart(2, "0");

function localDateOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timestampOffset(days, hour = 10) {
  const date = new Date();
  date.setHours(hour, 15, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function makeBooking({
  id,
  code,
  hotelId,
  hotelName,
  cityName,
  address,
  guest,
  phone,
  email,
  guestOrigin,
  adults,
  children = 0,
  infants = 0,
  rooms,
  roomName,
  mealPlan,
  checkInOffset,
  nights,
  status,
  voucherStatus = "NOT_ISSUED",
  paymentStatus = "UNPAID",
  arrivalFrom,
  nextDestination,
  specialRequests,
}) {
  const confirmed = status === "CONFIRMED" || status === "CANCEL_REQUESTED";
  const issued = voucherStatus === "ISSUED";

  return {
    publicId: id,
    bookingCode: code,
    createdAt: timestampOffset(Math.min(-1, checkInOffset - 8), 11),
    crmBookingPublicId: `crm-${id}`,
    crmBookingCode: `CRM-${code.slice(3)}`,
    hotelPublicId: hotelId,
    hotelName,
    hotelPropertyName: hotelName,
    cityName,
    address,
    stateName: cityName === "Pokhara" ? "Gandaki" : "Bagmati",
    countryName: "Nepal",
    countryCode: "NP",
    leadGuestName: guest,
    leadGuestPhone: phone,
    leadGuestEmail: email,
    guestOrigin,
    adults,
    children,
    infants,
    rooms,
    roomName,
    mealPlan,
    checkIn: localDateOffset(checkInOffset),
    checkOut: localDateOffset(checkInOffset + nights),
    nights,
    status,
    supplierConfirmationNumber: confirmed ? `HTL-${code.slice(3)}-NP` : null,
    approvedAt: confirmed ? timestampOffset(Math.min(-1, checkInOffset - 3), 15) : null,
    voucherStatus,
    voucherNumber: issued ? `VCH-${code.slice(3)}` : null,
    voucherIssuedAt: issued ? timestampOffset(Math.min(-1, checkInOffset - 1), 14) : null,
    paymentStatus,
    specialRequests: specialRequests || null,
    opsNotes: status === "TENANT_APPROVAL_REQUIRED"
      ? "Revised rate received; tenant response pending."
      : confirmed
        ? "Supplier confirmation checked by operations."
        : null,
    arrivalFrom: arrivalFrom || null,
    nextDestination: nextDestination || null,
  };
}

const ADDRESS = {
  yak: "Durbar Marg, Kathmandu",
  shanker: "Lazimpat, Kathmandu",
  himalaya: "Kupondole, Lalitpur",
  barahi: "Lakeside Road, Pokhara",
  landmark: "Lakeside, Pokhara",
  temple: "Gaurighat, Lakeside, Pokhara",
};

export const HOTEL_OPERATION_MOCK_BOOKINGS = [
  makeBooking({
    id: "mock-yak-1025", code: "BK-1025", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Rahul Sharma", phone: "+91 98765 43210",
    email: "rahul.sharma@example.com", guestOrigin: "Delhi, India", adults: 6, children: 2,
    rooms: 3, roomName: "Deluxe Heritage Room", mealPlan: "Breakfast", checkInOffset: 0, nights: 3,
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PAID", arrivalFrom: "Pokhara",
    nextDestination: "Chitwan", specialRequests: "Airport pickup and one vegetarian breakfast.",
  }),
  makeBooking({
    id: "mock-yak-1026", code: "BK-1026", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Aarav Mehta", phone: "+91 98111 22334",
    email: "aarav.mehta@example.com", guestOrigin: "Mumbai, India", adults: 4, children: 1,
    rooms: 2, roomName: "Club Room", mealPlan: "Half Board", checkInOffset: -2, nights: 4,
    status: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", arrivalFrom: "Delhi", nextDestination: "Nagarkot",
  }),
  makeBooking({
    id: "mock-yak-1027", code: "BK-1027", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Sophie Martin", phone: "+33 6 12 34 56 78",
    email: "sophie.martin@example.com", guestOrigin: "Paris, France", adults: 2, rooms: 1,
    roomName: "Deluxe Room", mealPlan: "Breakfast", checkInOffset: 1, nights: 2, status: "UNDER_REVIEW",
    arrivalFrom: "Doha", nextDestination: "Bhaktapur",
  }),
  makeBooking({
    id: "mock-yak-1028", code: "BK-1028", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Nisha Kapoor", phone: "+91 98990 11223",
    email: "nisha.kapoor@example.com", guestOrigin: "Jaipur, India", adults: 3, children: 1,
    rooms: 2, roomName: "Executive Room", mealPlan: "Breakfast", checkInOffset: 3, nights: 4,
    status: "TENANT_APPROVAL_REQUIRED", arrivalFrom: "Varanasi", nextDestination: "Pokhara",
  }),
  makeBooking({
    id: "mock-shanker-1031", code: "BK-1031", hotelId: "hotel-shanker", hotelName: "Hotel Shanker",
    cityName: "Kathmandu", address: ADDRESS.shanker, guest: "James Wilson", phone: "+44 7700 900123",
    email: "james.wilson@example.com", guestOrigin: "London, UK", adults: 2, rooms: 1,
    roomName: "Heritage Deluxe", mealPlan: "Breakfast", checkInOffset: 6, nights: 3, status: "REQUESTED",
    arrivalFrom: "Dubai", nextDestination: "Pokhara",
  }),
  makeBooking({
    id: "mock-shanker-1032", code: "BK-1032", hotelId: "hotel-shanker", hotelName: "Hotel Shanker",
    cityName: "Kathmandu", address: ADDRESS.shanker, guest: "Meera Iyer", phone: "+91 99887 76655",
    email: "meera.iyer@example.com", guestOrigin: "Chennai, India", adults: 5, children: 2,
    rooms: 3, roomName: "Suite", mealPlan: "Full Board", checkInOffset: -3, nights: 3,
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PAID", arrivalFrom: "Pokhara",
    nextDestination: "Airport",
  }),
  makeBooking({
    id: "mock-shanker-1033", code: "BK-1033", hotelId: "hotel-shanker", hotelName: "Hotel Shanker",
    cityName: "Kathmandu", address: ADDRESS.shanker, guest: "Daniel Kim", phone: "+82 10 1234 5678",
    email: "daniel.kim@example.com", guestOrigin: "Seoul, South Korea", adults: 2, rooms: 1,
    roomName: "Deluxe Room", mealPlan: "Breakfast", checkInOffset: 0, nights: 2,
    status: "CONFIRMED", paymentStatus: "UNPAID", arrivalFrom: "Bangkok", nextDestination: "Chitwan",
  }),
  makeBooking({
    id: "mock-himalaya-1035", code: "BK-1035", hotelId: "hotel-himalaya", hotelName: "Hotel Himalaya",
    cityName: "Kathmandu", address: ADDRESS.himalaya, guest: "Priya Desai", phone: "+91 97654 32109",
    email: "priya.desai@example.com", guestOrigin: "Ahmedabad, India", adults: 4, children: 2,
    rooms: 2, roomName: "Executive Room", mealPlan: "Breakfast", checkInOffset: 5, nights: 3,
    status: "TENANT_ACCEPTED", arrivalFrom: "Delhi", nextDestination: "Pokhara",
  }),
  makeBooking({
    id: "mock-himalaya-1036", code: "BK-1036", hotelId: "hotel-himalaya", hotelName: "Hotel Himalaya",
    cityName: "Kathmandu", address: ADDRESS.himalaya, guest: "Oliver Brown", phone: "+61 412 345 678",
    email: "oliver.brown@example.com", guestOrigin: "Sydney, Australia", adults: 2, rooms: 1,
    roomName: "Deluxe Room", mealPlan: "Room Only", checkInOffset: 10, nights: 2, status: "CANCELLED",
    paymentStatus: "REFUNDED", arrivalFrom: "Singapore", nextDestination: "Thimphu",
  }),
  makeBooking({
    id: "mock-barahi-1040", code: "BK-1040", hotelId: "hotel-barahi", hotelName: "Hotel Barahi",
    cityName: "Pokhara", address: ADDRESS.barahi, guest: "Ananya Singh", phone: "+91 96543 21098",
    email: "ananya.singh@example.com", guestOrigin: "Lucknow, India", adults: 4, children: 1,
    rooms: 2, roomName: "Deluxe Lake View", mealPlan: "Half Board", checkInOffset: -1, nights: 3,
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PARTIALLY_PAID", arrivalFrom: "Kathmandu",
    nextDestination: "Jomsom",
  }),
  makeBooking({
    id: "mock-barahi-1041", code: "BK-1041", hotelId: "hotel-barahi", hotelName: "Hotel Barahi",
    cityName: "Pokhara", address: ADDRESS.barahi, guest: "Noah Anderson", phone: "+1 202 555 0147",
    email: "noah.anderson@example.com", guestOrigin: "New York, USA", adults: 2, children: 2,
    rooms: 2, roomName: "Family Room", mealPlan: "Breakfast", checkInOffset: 4, nights: 4,
    status: "REQUESTED", arrivalFrom: "Kathmandu", nextDestination: "Chitwan",
  }),
  makeBooking({
    id: "mock-barahi-1042", code: "BK-1042", hotelId: "hotel-barahi", hotelName: "Hotel Barahi",
    cityName: "Pokhara", address: ADDRESS.barahi, guest: "Rohan Verma", phone: "+91 95432 10987",
    email: "rohan.verma@example.com", guestOrigin: "Pune, India", adults: 3, rooms: 2,
    roomName: "Super Deluxe", mealPlan: "Breakfast", checkInOffset: 1, nights: 2, status: "UNDER_REVIEW",
    arrivalFrom: "Kathmandu", nextDestination: "Kathmandu",
  }),
  makeBooking({
    id: "mock-landmark-1045", code: "BK-1045", hotelId: "hotel-landmark", hotelName: "Hotel Landmark Pokhara",
    cityName: "Pokhara", address: ADDRESS.landmark, guest: "Fatima Khan", phone: "+971 50 123 4567",
    email: "fatima.khan@example.com", guestOrigin: "Dubai, UAE", adults: 2, children: 1,
    rooms: 1, roomName: "Lake View Room", mealPlan: "Breakfast", checkInOffset: 0, nights: 3,
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PAID", arrivalFrom: "Kathmandu",
    nextDestination: "Kathmandu",
  }),
  makeBooking({
    id: "mock-landmark-1046", code: "BK-1046", hotelId: "hotel-landmark", hotelName: "Hotel Landmark Pokhara",
    cityName: "Pokhara", address: ADDRESS.landmark, guest: "Vikram Joshi", phone: "+91 94321 09876",
    email: "vikram.joshi@example.com", guestOrigin: "Indore, India", adults: 6, children: 2,
    rooms: 3, roomName: "Family Suite", mealPlan: "Half Board", checkInOffset: 2, nights: 4,
    status: "CANCEL_REQUESTED", paymentStatus: "PARTIALLY_PAID", arrivalFrom: "Kathmandu",
    nextDestination: "Lumbini",
  }),
  makeBooking({
    id: "mock-temple-1048", code: "BK-1048", hotelId: "hotel-temple-tree", hotelName: "Temple Tree Resort & Spa",
    cityName: "Pokhara", address: ADDRESS.temple, guest: "Emma Garcia", phone: "+34 612 345 678",
    email: "emma.garcia@example.com", guestOrigin: "Madrid, Spain", adults: 2, rooms: 1,
    roomName: "Classic Room", mealPlan: "Breakfast", checkInOffset: -2, nights: 2,
    status: "CONFIRMED", paymentStatus: "PAID", arrivalFrom: "Chitwan", nextDestination: "Kathmandu",
  }),
  makeBooking({
    id: "mock-temple-1049", code: "BK-1049", hotelId: "hotel-temple-tree", hotelName: "Temple Tree Resort & Spa",
    cityName: "Pokhara", address: ADDRESS.temple, guest: "Kabir Malhotra", phone: "+91 93210 98765",
    email: "kabir.malhotra@example.com", guestOrigin: "Bengaluru, India", adults: 4, children: 1,
    infants: 1, rooms: 2, roomName: "Junior Suite", mealPlan: "Full Board", checkInOffset: 7, nights: 5,
    status: "TENANT_APPROVAL_REQUIRED", arrivalFrom: "Kathmandu", nextDestination: "Lumbini",
  }),
];

const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 180));

export async function getMockBookings({ page = 0, size = 25, status } = {}) {
  const filtered = status
    ? HOTEL_OPERATION_MOCK_BOOKINGS.filter((booking) => booking.status === status)
    : HOTEL_OPERATION_MOCK_BOOKINGS;
  const totalElements = filtered.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
  const items = filtered.slice(page * size, page * size + size).map((booking) => ({ ...booking }));

  return wait({
    items,
    pagination: {
      page,
      size,
      totalElements,
      totalPages,
      hasNext: page + 1 < totalPages,
      hasPrevious: page > 0,
    },
  });
}

export async function getMockOperationById(publicId) {
  const booking = HOTEL_OPERATION_MOCK_BOOKINGS.find((item) => item.publicId === publicId);
  return wait(booking ? { ...booking } : null);
}

export async function getMockSummary() {
  const today = localDateOffset(0);
  const confirmed = HOTEL_OPERATION_MOCK_BOOKINGS.filter((booking) => booking.status === "CONFIRMED");
  const countStatus = (status) => HOTEL_OPERATION_MOCK_BOOKINGS.filter((booking) => booking.status === status).length;
  const pendingStatuses = new Set(["REQUESTED", "UNDER_REVIEW", "TENANT_APPROVAL_REQUIRED", "TENANT_ACCEPTED"]);

  return wait({
    totalBookings: HOTEL_OPERATION_MOCK_BOOKINGS.length,
    totalGuests: HOTEL_OPERATION_MOCK_BOOKINGS.reduce(
      (total, booking) => total + booking.adults + booking.children + booking.infants,
      0,
    ),
    totalRooms: HOTEL_OPERATION_MOCK_BOOKINGS.reduce((total, booking) => total + booking.rooms, 0),
    todayCheckIns: confirmed.filter((booking) => booking.checkIn === today).length,
    todayCheckOuts: confirmed.filter((booking) => booking.checkOut === today).length,
    pendingConfirmations: HOTEL_OPERATION_MOCK_BOOKINGS.filter((booking) => pendingStatuses.has(booking.status)).length,
    voucherPending: confirmed.filter((booking) => booking.voucherStatus === "NOT_ISSUED").length,
    inHouseGuests: confirmed
      .filter((booking) => booking.checkIn < today && booking.checkOut > today)
      .reduce((total, booking) => total + booking.adults + booking.children + booking.infants, 0),
    paymentPending: HOTEL_OPERATION_MOCK_BOOKINGS.filter(
      (booking) => booking.paymentStatus === "UNPAID" || booking.paymentStatus === "PARTIALLY_PAID",
    ).length,
    actionRequired: {
      requested: countStatus("REQUESTED"),
      underReview: countStatus("UNDER_REVIEW"),
      tenantApprovalRequired: countStatus("TENANT_APPROVAL_REQUIRED"),
      cancelRequested: countStatus("CANCEL_REQUESTED"),
    },
  });
}
