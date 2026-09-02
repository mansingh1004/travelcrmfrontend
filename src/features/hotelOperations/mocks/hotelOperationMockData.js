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

const DESTINATION_STAYS = {
  Kathmandu: {
    hotelPublicId: "hotel-yak-yeti",
    hotelName: "Hotel Yak & Yeti",
    propertyName: "Hotel Yak & Yeti · Durbar Marg",
    address: "Durbar Marg, Kathmandu",
    contactPhone: "+977 1 4248999",
    roomType: "Deluxe Heritage Room",
  },
  Pokhara: {
    hotelPublicId: "hotel-barahi",
    hotelName: "Hotel Barahi",
    propertyName: "Hotel Barahi · Lakeside",
    address: "Lakeside Road, Pokhara",
    contactPhone: "+977 61 460617",
    roomType: "Deluxe Lake View",
  },
  Chitwan: {
    hotelPublicId: "hotel-jungle-safari",
    hotelName: "Jungle Safari Lodge",
    propertyName: "Jungle Safari Lodge · Sauraha",
    address: "Sauraha, Chitwan",
    contactPhone: "+977 56 580069",
    roomType: "Garden Cottage",
  },
  Nagarkot: {
    hotelPublicId: "hotel-country-villa",
    hotelName: "Hotel Country Villa",
    propertyName: "Hotel Country Villa · Nagarkot",
    address: "Naldum, Nagarkot",
    contactPhone: "+977 1 6680127",
    roomType: "Mountain View Room",
  },
  Lumbini: {
    hotelPublicId: "hotel-buddha-maya",
    hotelName: "Buddha Maya Garden Hotel",
    propertyName: "Buddha Maya Garden Hotel · Lumbini",
    address: "Lumbini Sanskritik, Rupandehi",
    contactPhone: "+977 71 580220",
    roomType: "Deluxe Garden Room",
  },
  Bhaktapur: {
    hotelPublicId: "hotel-heritage-bhaktapur",
    hotelName: "Hotel Heritage Bhaktapur",
    propertyName: "Hotel Heritage · Suryabinayak",
    address: "Barahisthan, Bhaktapur",
    contactPhone: "+977 1 6611628",
    roomType: "Heritage Room",
  },
};

const locationId = (value, suffix) =>
  `${String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${suffix}`;

function externalStop({ locationName, type, sequence, checkInOffset, rooms, adults, children }) {
  const hotel = DESTINATION_STAYS[locationName];
  const isArrival = type === "ARRIVAL";
  const checkIn = localDateOffset(isArrival ? checkInOffset - 2 : checkInOffset);
  const checkOut = localDateOffset(isArrival ? checkInOffset : checkInOffset + 2);

  return {
    locationId: locationId(locationName, type.toLowerCase()),
    locationName,
    type,
    sequence,
    arrivalDate: checkIn,
    departureDate: checkOut,
    stays: hotel ? [{
      ...hotel,
      checkIn,
      checkOut,
      nights: 2,
      totalRooms: Math.max(1, Math.min(rooms, 2)),
      totalPax: adults + children,
      extraAdultBeds: adults > 4 ? 1 : 0,
      extraChildBeds: children > 0 ? 1 : 0,
      childrenWithoutBed: 0,
      mealPlan: type === "NEXT" ? "Half Board" : "Breakfast",
      bedType: "King / Twin on request",
      confirmationStatus: "CONFIRMED",
      confirmationNumber: `DEMO-${sequence}${String(locationName).slice(0, 3).toUpperCase()}`,
      voucherStatus: "ISSUED",
      specialRequests: "Please keep the group rooms on the same floor.",
      rooms: [{
        roomType: hotel.roomType,
        quantity: Math.max(1, Math.min(rooms, 2)),
        adults,
        children,
        extraAdultBeds: adults > 4 ? 1 : 0,
        extraChildBeds: children > 0 ? 1 : 0,
        childrenWithoutBed: 0,
        mealPlan: type === "NEXT" ? "Half Board" : "Breakfast",
        bedType: "King / Twin on request",
      }],
    }] : [],
  };
}

function makeBooking({
  id,
  code,
  hotelId,
  hotelName,
  hotelBrandId,
  hotelBrandName,
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
  roomAllocations,
  extraAdultBeds = 0,
  extraChildBeds = 0,
  childrenWithoutBed = 0,
  checkInOffset,
  nights,
  status,
  voucherStatus = "NOT_ISSUED",
  // MarketplacePaymentStatus, not invented names. These fixtures used to carry UNPAID /
  // PARTIALLY_PAID / REFUNDED, which are not in the server enum — and because the model's
  // paymentState() had been written against these fixtures rather than the API, live PART_PAID and
  // PENDING rows both fell through to a red "unknown" tone. Demo data drifting from the enum is how
  // that happened, so it stays on the enum.
  paymentStatus = "PENDING",
  rejectionReason,
  arrivalFrom,
  nextDestination,
  specialRequests,
}) {
  const confirmed = status === "CONFIRMED" || status === "CANCEL_REQUESTED" || status === "CANCELLATION_QUOTED";
  const issued = voucherStatus === "ISSUED";
  const yakYetiProperty = String(hotelId).startsWith("hotel-yak-yeti");

  // ── Money ────────────────────────────────────────────────────────────────
  // A REQUESTED row has NO agreed price: the platform quotes at approval. Leaving it null is the
  // whole point — a demo that showed ₹0 there would train the reader to read "free".
  const currency = "INR";
  const payable = status === "REQUESTED" ? null : rooms * nights * 4500 + (adults + children) * 500;
  const selling = payable === null ? null : Math.round(payable * 1.18);
  const paid = payable === null || paymentStatus === "PENDING"
    ? 0
    : paymentStatus === "PAID"
      ? payable
      : paymentStatus === "PART_PAID"
        ? Math.round(payable * 0.4)
        : 0;

  const revising = status === "TENANT_APPROVAL_REQUIRED";
  const cancelStarted = status === "CANCEL_REQUESTED" || status === "CANCELLATION_QUOTED" || status === "CANCELLED";
  const quoted = status === "CANCELLATION_QUOTED";
  const cancelled = status === "CANCELLED";
  const retained = cancelled && payable !== null ? Math.round(payable * 0.25) : null;

  const booking = {
    publicId: id,
    bookingCode: code,
    createdAt: timestampOffset(Math.min(-1, checkInOffset - 8), 11),
    crmBookingPublicId: `crm-${id}`,
    crmBookingCode: `CRM-${code.slice(3)}`,
    hotelPublicId: hotelId,
    hotelName,
    hotelPropertyName: hotelName,
    hotelBrandId: hotelBrandId || (yakYetiProperty ? "brand-yak-yeti" : `brand-${hotelId}`),
    hotelBrandName: hotelBrandName || (yakYetiProperty ? "Yak & Yeti" : hotelName),
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

    // ── Money ──────────────────────────────────────────────────────────────
    currency,
    tenantPayable: payable,
    // Re-priced between submit and approval on some rows, so the "quoted when submitted" hint has
    // something to show.
    quotedTenantPayable: payable === null ? null : (revising || nights > 3 ? payable - 1500 : payable),
    tenantCustomerSellingAmount: selling,
    amountPaid: paid,
    /*
      SERVER-DERIVED in production, and modelled that way here on purpose: after a settled
      cancellation the debt is the RETAINED charge, not the original payable. A fixture that returned
      `payable - paid` would make the drawer look correct while hiding the bug it is guarding against.
    */
    amountOutstanding: payable === null
      ? null
      : cancelled
        ? Math.max(0, (retained ?? 0) - paid)
        : Math.max(0, payable - paid),

    // ── An open price revision ─────────────────────────────────────────────
    // `tenantPayable` above stays the OLD number while this is open — that is the contract.
    revisedTenantPayable: revising && payable !== null ? payable + 3200 : null,
    revisionPreviousPayable: revising ? payable : null,
    revisedCancellationTerms: revising
      ? "Non-refundable within 72 hours of check-in if the revised rate is accepted."
      : null,
    revisionRequestedAt: revising ? timestampOffset(-1, 9) : null,
    revisionExpiresAt: revising ? timestampOffset(1, 18) : null,
    revisionCount: revising ? 1 : null,
    priceRevisionReason: revising
      ? "Supplier revised the rate for these dates — peak-season surcharge on the room category."
      : null,

    rejectionReason: rejectionReason || null,
    cancellationTerms: "Free cancellation up to 7 days before check-in. 25% of the stay retained inside 7 days, 100% inside 48 hours.",

    // ── Cancellation, across its three stages ──────────────────────────────
    cancelRequestedAt: cancelStarted ? timestampOffset(-2, 12) : null,
    cancelRequestReason: cancelStarted ? "Customer moved the trip to next month." : null,
    quotedCancellationCharge: quoted && payable !== null ? Math.round(payable * 0.3) : null,
    cancellationQuoteNote: quoted
      ? "The hotel will retain 30% for this date range. Accepting settles the balance against your credit."
      : null,
    cancellationQuotedAt: quoted ? timestampOffset(-1, 10) : null,
    cancellationQuoteExpiresAt: quoted ? timestampOffset(2, 18) : null,
    cancelledAt: cancelled ? timestampOffset(-1, 16) : null,
    cancellationCharge: retained,
    tenantRefundAmount: cancelled && payable !== null ? Math.max(0, paid - (retained ?? 0)) : null,
    cancellationReason: cancelled ? "Cancelled at the customer's request; supplier retained 25%." : null,
  };

  const currentRoomAllocations = roomAllocations || [{
    roomType: roomName,
    quantity: rooms,
    adults,
    children,
    extraAdultBeds,
    extraChildBeds,
    childrenWithoutBed,
    mealPlan,
    bedType: "King / Twin on request",
  }];

  booking.travelStops = [
    externalStop({
      locationName: arrivalFrom,
      type: "ARRIVAL",
      sequence: 1,
      checkInOffset,
      rooms,
      adults,
      children,
    }),
    {
      locationId: locationId(cityName, "current"),
      locationName: cityName,
      type: "CURRENT",
      sequence: 2,
      arrivalDate: booking.checkIn,
      departureDate: booking.checkOut,
      stays: [{
        hotelPublicId: hotelId,
        hotelName,
        propertyName: hotelName,
        address,
        contactPhone: cityName === "Pokhara" ? "+977 61 460000" : "+977 1 4200000",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        totalRooms: rooms,
        totalPax: adults + children + infants,
        extraAdultBeds,
        extraChildBeds,
        childrenWithoutBed,
        mealPlan,
        bedType: "King / Twin on request",
        confirmationStatus: confirmed ? "CONFIRMED" : "PENDING",
        confirmationNumber: booking.supplierConfirmationNumber,
        voucherStatus,
        specialRequests: booking.specialRequests,
        rooms: currentRoomAllocations,
      }],
    },
    externalStop({
      locationName: nextDestination,
      type: "NEXT",
      sequence: 3,
      checkInOffset: checkInOffset + nights,
      rooms,
      adults,
      children,
    }),
  ].filter((stop) => stop.locationName);

  return booking;
}

const ADDRESS = {
  yak: "Durbar Marg, Kathmandu",
  shanker: "Lazimpat, Kathmandu",
  himalaya: "Kupondole, Lalitpur",
  barahi: "Lakeside Road, Pokhara",
  landmark: "Lakeside, Pokhara",
  temple: "Gaurighat, Lakeside, Pokhara",
};

const YAK_YETI_CUSTOMERS = [
  "Arjun Khanna", "Maya Thompson", "Neha Bansal", "Liam Chen",
  "Sanjay Rao", "Isabella Rossi", "Ritika Sen", "Ethan Walker",
  "Aditi Nair", "Lucas Muller", "Karan Bedi", "Charlotte Evans",
  "Sameer Qureshi", "Hana Suzuki", "Devika Shah", "Benjamin Clark",
];

function buildYakYetiBranchBookings() {
  const properties = [
    {
      count: 4,
      hotelId: "hotel-yak-yeti",
      hotelName: "Hotel Yak & Yeti · Kathmandu",
      cityName: "Kathmandu",
      address: ADDRESS.yak,
      roomName: "Deluxe Heritage Room",
      arrivalFrom: "Pokhara",
      nextDestination: "Chitwan",
    },
    {
      count: 7,
      hotelId: "hotel-yak-yeti-pokhara",
      hotelName: "Yak & Yeti Lakeside · Pokhara",
      cityName: "Pokhara",
      address: "Lakeside Road, Pokhara",
      roomName: "Lake View Room",
      arrivalFrom: "Kathmandu",
      nextDestination: "Chitwan",
    },
    {
      count: 5,
      hotelId: "hotel-yak-yeti-chitwan",
      hotelName: "Yak & Yeti Jungle Retreat · Chitwan",
      cityName: "Chitwan",
      address: "Sauraha Road, Chitwan",
      roomName: "Garden Cottage",
      arrivalFrom: "Pokhara",
      nextDestination: "Kathmandu",
    },
  ];
  const statuses = [
    "CONFIRMED", "CONFIRMED", "UNDER_REVIEW", "REQUESTED",
    "CONFIRMED", "TENANT_APPROVAL_REQUIRED", "CONFIRMED", "TENANT_ACCEPTED",
  ];
  const offsets = [-3, -1, 0, 1, 2, 4, 6, 8];
  let customerIndex = 0;

  return properties.flatMap((property) =>
    Array.from({ length: property.count }, (_, propertyIndex) => {
      const index = customerIndex++;
      const status = statuses[index % statuses.length];
      const confirmed = status === "CONFIRMED";
      const rooms = 1 + (index % 3);
      const children = index % 3 === 0 ? 2 : index % 3 === 1 ? 1 : 0;
      const guest = YAK_YETI_CUSTOMERS[index];

      return makeBooking({
        id: `mock-yak-branch-${2001 + index}`,
        code: `BK-${2001 + index}`,
        hotelId: property.hotelId,
        hotelName: property.hotelName,
        hotelBrandId: "brand-yak-yeti",
        hotelBrandName: "Yak & Yeti",
        cityName: property.cityName,
        address: property.address,
        guest,
        phone: `+91 98${pad(index)} 45${pad(propertyIndex)} 10`,
        email: `${guest.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        guestOrigin: index % 2 === 0 ? "India" : "International",
        adults: 2 + (index % 5),
        children,
        infants: index % 7 === 0 ? 1 : 0,
        rooms,
        roomName: property.roomName,
        mealPlan: index % 2 === 0 ? "Breakfast" : "Half Board",
        extraAdultBeds: index % 4 === 0 ? 1 : 0,
        extraChildBeds: children > 0 && index % 2 === 0 ? 1 : 0,
        childrenWithoutBed: children > 1 ? 1 : 0,
        checkInOffset: offsets[index % offsets.length],
        nights: 2 + (index % 4),
        status,
        voucherStatus: confirmed && index % 2 === 0 ? "ISSUED" : "NOT_ISSUED",
        paymentStatus: confirmed && index % 3 === 0 ? "PAID" : "PART_PAID",
        arrivalFrom: property.arrivalFrom,
        nextDestination: property.nextDestination,
        specialRequests: index % 3 === 0 ? "Early check-in requested, subject to availability." : null,
      });
    }),
  );
}

export const HOTEL_OPERATION_MOCK_BOOKINGS = [
  makeBooking({
    id: "mock-yak-1025", code: "BK-1025", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Rahul Sharma", phone: "+91 98765 43210",
    email: "rahul.sharma@example.com", guestOrigin: "Delhi, India", adults: 6, children: 2,
    rooms: 3, roomName: "Deluxe Heritage Room", mealPlan: "Breakfast", checkInOffset: 0, nights: 3,
    extraAdultBeds: 1, extraChildBeds: 1,
    roomAllocations: [
      {
        roomType: "Deluxe Heritage Room", quantity: 2, adults: 4, children: 1,
        extraAdultBeds: 1, extraChildBeds: 0, childrenWithoutBed: 0,
        mealPlan: "Breakfast", bedType: "King Bed",
      },
      {
        roomType: "Club Room", quantity: 1, adults: 2, children: 1,
        extraAdultBeds: 0, extraChildBeds: 1, childrenWithoutBed: 0,
        mealPlan: "Breakfast", bedType: "Twin Beds",
      },
    ],
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PAID", arrivalFrom: "Pokhara",
    nextDestination: "Chitwan", specialRequests: "Airport pickup and one vegetarian breakfast.",
  }),
  makeBooking({
    id: "mock-yak-1026", code: "BK-1026", hotelId: "hotel-yak-yeti", hotelName: "Hotel Yak & Yeti",
    cityName: "Kathmandu", address: ADDRESS.yak, guest: "Aarav Mehta", phone: "+91 98111 22334",
    email: "aarav.mehta@example.com", guestOrigin: "Mumbai, India", adults: 4, children: 1,
    rooms: 2, roomName: "Club Room", mealPlan: "Half Board", checkInOffset: -2, nights: 4,
    status: "CONFIRMED", paymentStatus: "PART_PAID", arrivalFrom: "Delhi", nextDestination: "Nagarkot",
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
    status: "CONFIRMED", paymentStatus: "PENDING", arrivalFrom: "Bangkok", nextDestination: "Chitwan",
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
    // Paid in full, then cancelled: the retained charge and the refund are what the drawer shows,
    // and `amountOutstanding` drops to the retained amount rather than staying the original payable.
    paymentStatus: "PAID", arrivalFrom: "Singapore", nextDestination: "Thimphu",
  }),
  makeBooking({
    id: "mock-barahi-1040", code: "BK-1040", hotelId: "hotel-barahi", hotelName: "Hotel Barahi",
    cityName: "Pokhara", address: ADDRESS.barahi, guest: "Ananya Singh", phone: "+91 96543 21098",
    email: "ananya.singh@example.com", guestOrigin: "Lucknow, India", adults: 4, children: 1,
    rooms: 2, roomName: "Deluxe Lake View", mealPlan: "Half Board", checkInOffset: -1, nights: 3,
    status: "CONFIRMED", voucherStatus: "ISSUED", paymentStatus: "PART_PAID", arrivalFrom: "Kathmandu",
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
    status: "CANCEL_REQUESTED", paymentStatus: "PART_PAID", arrivalFrom: "Kathmandu",
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
  // Two states the fixtures never covered, so the drawer panels that read them had nothing to show
  // in the mode that is ON by default in development.
  makeBooking({
    id: "mock-himalaya-1037", code: "BK-1037", hotelId: "hotel-himalaya", hotelName: "Hotel Himalaya",
    cityName: "Kathmandu", address: ADDRESS.himalaya, guest: "Grace Okafor", phone: "+234 802 123 4567",
    email: "grace.okafor@example.com", guestOrigin: "Lagos, Nigeria", adults: 2, rooms: 1,
    roomName: "Deluxe Room", mealPlan: "Breakfast", checkInOffset: 9, nights: 3, status: "REJECTED",
    rejectionReason: "The hotel has no availability in this room category for these dates.",
    arrivalFrom: "Doha", nextDestination: "Pokhara",
  }),
  makeBooking({
    id: "mock-temple-1050", code: "BK-1050", hotelId: "hotel-temple-tree", hotelName: "Temple Tree Resort & Spa",
    cityName: "Pokhara", address: ADDRESS.temple, guest: "Yusuf Ahmed", phone: "+92 300 1234567",
    email: "yusuf.ahmed@example.com", guestOrigin: "Karachi, Pakistan", adults: 4, children: 2,
    rooms: 2, roomName: "Junior Suite", mealPlan: "Half Board", checkInOffset: 5, nights: 3,
    status: "CANCELLATION_QUOTED", voucherStatus: "ISSUED", paymentStatus: "PART_PAID",
    arrivalFrom: "Kathmandu", nextDestination: "Lumbini",
  }),
  ...buildYakYetiBranchBookings(),
];

const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 180));

function scopedBookings({ status, brandId, hotelPublicId } = {}) {
  return HOTEL_OPERATION_MOCK_BOOKINGS.filter((booking) => {
    if (status && booking.status !== status) return false;
    if (brandId && booking.hotelBrandId !== brandId) return false;
    if (hotelPublicId && booking.hotelPublicId !== hotelPublicId) return false;
    return true;
  });
}

function summarize(bookings) {
  const today = localDateOffset(0);
  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
  const countStatus = (status) => bookings.filter((booking) => booking.status === status).length;
  const pendingStatuses = new Set(["REQUESTED", "UNDER_REVIEW", "TENANT_APPROVAL_REQUIRED", "TENANT_ACCEPTED"]);

  return {
    totalBookings: bookings.length,
    totalGuests: bookings.reduce(
      (total, booking) => total + booking.adults + booking.children + booking.infants,
      0,
    ),
    totalRooms: bookings.reduce((total, booking) => total + booking.rooms, 0),
    todayCheckIns: confirmed.filter((booking) => booking.checkIn === today).length,
    todayCheckOuts: confirmed.filter((booking) => booking.checkOut === today).length,
    pendingConfirmations: bookings.filter((booking) => pendingStatuses.has(booking.status)).length,
    voucherPending: confirmed.filter((booking) => booking.voucherStatus === "NOT_ISSUED").length,
    inHouseGuests: confirmed
      .filter((booking) => booking.checkIn < today && booking.checkOut > today)
      .reduce((total, booking) => total + booking.adults + booking.children + booking.infants, 0),
    // Mirrors MarketplacePaymentStatus.isOutstanding() — PENDING and PART_PAID, nothing else.
    paymentPending: bookings.filter(
      (booking) => booking.paymentStatus === "PENDING" || booking.paymentStatus === "PART_PAID",
    ).length,
    actionRequired: {
      requested: countStatus("REQUESTED"),
      underReview: countStatus("UNDER_REVIEW"),
      tenantApprovalRequired: countStatus("TENANT_APPROVAL_REQUIRED"),
      cancelRequested: countStatus("CANCEL_REQUESTED"),
    },
  };
}

export async function getMockBookings({ page = 0, size = 25, status, brandId, hotelPublicId } = {}) {
  const filtered = scopedBookings({ status, brandId, hotelPublicId });
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

export async function getMockSummary({ brandId, hotelPublicId } = {}) {
  return wait(summarize(scopedBookings({ brandId, hotelPublicId })));
}

export async function getMockHotelRollups() {
  const brands = new Map();

  for (const booking of HOTEL_OPERATION_MOCK_BOOKINGS) {
    const brandId = booking.hotelBrandId;
    if (!brands.has(brandId)) {
      brands.set(brandId, {
        brandId,
        brandName: booking.hotelBrandName,
        bookings: [],
        properties: new Map(),
      });
    }

    const brand = brands.get(brandId);
    brand.bookings.push(booking);
    if (!brand.properties.has(booking.hotelPublicId)) {
      brand.properties.set(booking.hotelPublicId, {
        hotelPublicId: booking.hotelPublicId,
        hotelName: booking.hotelPropertyName,
        locationName: booking.cityName,
        address: booking.address,
        bookings: [],
      });
    }
    brand.properties.get(booking.hotelPublicId).bookings.push(booking);
  }

  const result = Array.from(brands.values())
    .map((brand) => ({
      brandId: brand.brandId,
      brandName: brand.brandName,
      ...summarize(brand.bookings),
      properties: Array.from(brand.properties.values())
        .map((property) => ({
          hotelPublicId: property.hotelPublicId,
          hotelName: property.hotelName,
          locationName: property.locationName,
          address: property.address,
          ...summarize(property.bookings),
        }))
        .sort((a, b) => a.locationName.localeCompare(b.locationName)),
    }))
    .sort((a, b) => {
      if (a.brandId === "brand-yak-yeti") return -1;
      if (b.brandId === "brand-yak-yeti") return 1;
      return a.brandName.localeCompare(b.brandName);
    });

  return wait(result);
}
