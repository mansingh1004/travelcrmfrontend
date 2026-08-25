import API from "@shared/api/http";
import {
  getMockBookings,
  getMockHotelRollups,
  getMockOperationById,
  getMockSummary,
} from "../mocks/hotelOperationMockData";

const BOOKING_BASE = "/hotel-marketplace/bookings";
const HOTEL_BASE = "/hotel-marketplace/hotels";
const CREDIT_BASE = "/me/marketplace-credit";

const body = (response) => response?.data?.data ?? response?.data ?? null;

function clean(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined),
  );
}

/**
 * Hotel Operations intentionally composes the tenant marketplace API instead of introducing
 * guessed endpoint names. Every row returned by these calls is a PLATFORM HOTEL request owned by
 * the current tenant; authorization, tenant scoping and response unwrapping remain in the existing
 * marketplace service.
 *
 * The current list endpoint supports server-side pagination and one booking status only. Date,
 * location, property, voucher and operational-status aggregation need a dedicated backend read API
 * later. Capability flags keep the page honest until that API exists.
 */
export const HOTEL_OPERATION_CAPABILITIES = Object.freeze({
  serverPagination: true,
  bookingStatusFilter: true,
  dateFilter: false,
  locationFilter: false,
  hotelFilter: false,
  confirmationFilter: false,
  voucherFilter: false,
  propertyRollups: false,
  stayLifecycle: false,
});

async function count(status, config) {
  const result = await listBookings({ page: 0, size: 1, status: status || undefined }, config);
  return Number(result.pagination?.totalElements ?? result.items.length ?? 0);
}

async function listBookings({
  page = 0,
  size = 25,
  status,
  mock = false,
  brandId,
  hotelPublicId,
} = {}, config = {}) {
  if (mock) return getMockBookings({ page, size, status, brandId, hotelPublicId });
  const response = await API.get(BOOKING_BASE, {
    params: clean({ page, size, status }),
    ...config,
  });
  const rows = response?.data?.data;
  return {
    items: Array.isArray(rows) ? rows : [],
    pagination: response?.data?.pagination ?? null,
  };
}

const hotelOperationService = {
  capabilities: HOTEL_OPERATION_CAPABILITIES,

  /** Existing API: GET /hotel-marketplace/bookings. */
  getBookings: listBookings,

  /** Existing API: GET /hotel-marketplace/bookings/{publicId}. */
  getOperationById: (publicId, config = {}) => {
    const { mock = false, ...requestConfig } = config;
    if (mock) return getMockOperationById(publicId);
    return API.get(`${BOOKING_BASE}/${publicId}`, requestConfig).then(body);
  },

  /** Existing catalog detail, useful when a future tenant DTO exposes hotelPublicId. */
  getHotel: (hotelPublicId, stayDate, config = {}) =>
    API.get(`${HOTEL_BASE}/${hotelPublicId}`, {
      params: clean({ stayDate }),
      ...config,
    }).then(body),

  /**
   * Accurate figures that can be obtained from existing server-side count queries.
   * Unsupported values stay null; they are never computed from the visible page.
   */
  getSummary: async (config = {}) => {
    const { mock = false, brandId, hotelPublicId, ...requestConfig } = config;
    if (mock) return getMockSummary({ brandId, hotelPublicId });

    const [
      totalBookings,
      requested,
      underReview,
      tenantApprovalRequired,
      tenantAccepted,
      cancelRequested,
      credit,
    ] = await Promise.all([
      count(undefined, requestConfig),
      count("REQUESTED", requestConfig),
      count("UNDER_REVIEW", requestConfig),
      count("TENANT_APPROVAL_REQUIRED", requestConfig),
      count("TENANT_ACCEPTED", requestConfig),
      count("CANCEL_REQUESTED", requestConfig),
      API.get(CREDIT_BASE, requestConfig).then(body).catch(() => null),
    ]);

    const unsettledBookings = Number(credit?.unsettledBookings);

    return {
      totalBookings,
      totalGuests: null,
      totalRooms: null,
      todayCheckIns: null,
      todayCheckOuts: null,
      pendingConfirmations: requested + underReview + tenantApprovalRequired + tenantAccepted,
      voucherPending: null,
      inHouseGuests: null,
      paymentPending: Number.isFinite(unsettledBookings) ? unsettledBookings : null,
      actionRequired: {
        requested,
        underReview,
        tenantApprovalRequired,
        cancelRequested,
      },
    };
  },

  /** Mock-only property hierarchy; live mode deliberately has no guessed aggregate endpoint. */
  getHotelRollups: ({ mock = false } = {}) => (mock ? getMockHotelRollups() : Promise.resolve([])),
};

export default hotelOperationService;
