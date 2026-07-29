// import API from "@shared/api/http";
// import { uploadImageViaApi } from "./imageUpload";

// /**
//  * Hotel image upload — backend-proxied (quota-enforced + metered).
//  * Naam legacy hai (image aakhir Cloudinary pe hi jaati hai, bas backend ke through);
//  * signature same rakhi hai taaki koi caller na toote.
//  * Returns: secure_url (string) — yeh URL hotel ke imagePath mein save hota hai
//  */
// export function uploadHotelImageToCloudinary(file, onProgress) {
//   return uploadImageViaApi("/hotels/upload-image", file, onProgress);
// }

// // ==========================================================
// // 🌟 DATA TRANSFORMER: Frontend → Backend
// // ==========================================================
// function transformHotelData(frontendData) {
//   return {
//     // Basic Information
//     name:          frontendData.name,
//     destinationId: frontendData.destinationId
//       ? parseInt(frontendData.destinationId)
//       : null,
//     city:          frontendData.city,
//     stars:         frontendData.stars ? parseInt(frontendData.stars) : null,
//     rating:        frontendData.rating
//       ? parseFloat(frontendData.rating)
//       : null,
//     isDefault:     frontendData.isDefault ?? false,

//     // Address & Location
//     address:       frontendData.address,
//     mapUrl:        frontendData.mapUrl,
//     latitude:      frontendData.lat  ? parseFloat(frontendData.lat)  : null,
//     longitude:     frontendData.lng  ? parseFloat(frontendData.lng)  : null,

//     // Contact Information
//     contactPerson: frontendData.contact,
//     phone:         frontendData.phone,
//     email:         frontendData.email,
//     website:       frontendData.website,

//     // Description & Amenities
//     overview:      frontendData.overview,
//     amenities:     frontendData.amenities ?? [],

//     // ── IMAGE — Cloudinary secure_url (YEH NAYA ADD KIYA) ──
//     imagePath:     frontendData.imagePath || null,

//     // Room Types array
//     roomTypes: (frontendData.roomTypes ?? []).map((room) => ({
//       name:      room.name,
//       size:      room.size,
//       occupancy: room.occupancy ? parseInt(room.occupancy) : null,
//       bedType:   room.bedType,
//       description: room.description,
//     })),

//     // Meal Plans array
//     mealPlans: (frontendData.mealPlans ?? []).map((meal) => ({
//       name:        meal.name,
//       price:       meal.price !== "" ? parseFloat(meal.price) : 0,
//       description: meal.description,
//     })),
//   };
// }

// // ==========================================================
// // 🌟 DATA TRANSFORMER: Backend → Frontend
// // ==========================================================
// export function transformHotelResponse(backendData) {
//   return {
//     id:           backendData.id,
//     publicId:     backendData.publicId,
//     name:         backendData.name,
//     destinationId: backendData.destinationId?.toString() ?? "",
//     city:         backendData.city,
//     stars:        backendData.stars,
//     rating:       backendData.rating?.toString() ?? "",
//     isDefault:    backendData.isDefault ?? false,

//     address:      backendData.address,
//     mapUrl:       backendData.mapUrl,
//     lat:          backendData.latitude?.toString()  ?? "",
//     lng:          backendData.longitude?.toString() ?? "",

//     contact:      backendData.contactPerson,
//     phone:        backendData.phone,
//     email:        backendData.email,
//     website:      backendData.website,

//     overview:     backendData.overview,
//     amenities:    backendData.amenities ?? [],

//     // ── IMAGE — backend se wapas le aao (imagePath ya imageUrl) ──
//     imagePath:    backendData.imagePath ?? backendData.imageUrl ?? "",

//     roomTypes: (backendData.roomTypes ?? []).map((room) => ({
//       id:          room.id,
//       name:        room.name,
//       size:        room.size,
//       occupancy:   room.occupancy?.toString() ?? "",
//       bedType:     room.bedType,
//       description: room.description,
//     })),

//     mealPlans: (backendData.mealPlans ?? []).map((meal) => ({
//       id:          meal.id,
//       name:        meal.name,
//       price:       meal.price?.toString() ?? "",
//       description: meal.description,
//     })),
//   };
// }

// export const hotelService = {
//   // 1. GET ALL HOTELS
//   getAllHotels: () => {
//     return API.get("/hotels");
//   },

//   // 2. GET HOTELS BY DESTINATION ID
//   getHotelsByDestination: (destinationId) => {
//     return API.get(`/hotels/destination/${destinationId}`);
//   },

//   // 3. GET HOTEL BY ID
//   getHotelById: (id) => {
//     return API.get(`/hotels/${id}`);
//   },

//   // 4. CREATE HOTEL — imagePath already form mein hai (Cloudinary se)
//   createHotel: (formData) => {
//     const mappedData = transformHotelData(formData);
//     return API.post("/hotels", mappedData);
//   },

//   // 5. UPDATE HOTEL
//   updateHotel: (id, formData) => {
//     const mappedData = transformHotelData(formData);
//     return API.put(`/hotels/${id}`, mappedData);
//   },

//   // 6. DELETE HOTEL
//   deleteHotel: (id) => {
//     return API.delete(`/hotels/${id}`);
//   },

//   // 7. SET DEFAULT HOTEL FOR DESTINATION
//   setDefaultHotel: (destinationId, hotelId) => {
//     return API.patch(`/hotels/${hotelId}/set-default`, { destinationId });
//   },

//   // --------------------------------------------------------
//   // ROOM TYPES
//   // --------------------------------------------------------
//   addRoomType: (hotelId, roomData) => {
//     const mappedRoom = {
//       name:        roomData.name,
//       size:        roomData.size,
//       occupancy:   roomData.occupancy ? parseInt(roomData.occupancy) : null,
//       bedType:     roomData.bedType,
//       description: roomData.description,
//     };
//     return API.post(`/hotels/${hotelId}/room-types`, mappedRoom);
//   },

//   updateRoomType: (hotelId, roomTypeId, roomData) => {
//     const mappedRoom = {
//       name:        roomData.name,
//       size:        roomData.size,
//       occupancy:   roomData.occupancy ? parseInt(roomData.occupancy) : null,
//       bedType:     roomData.bedType,
//       description: roomData.description,
//     };
//     return API.put(`/hotels/${hotelId}/room-types/${roomTypeId}`, mappedRoom);
//   },

//   deleteRoomType: (hotelId, roomTypeId) => {
//     return API.delete(`/hotels/${hotelId}/room-types/${roomTypeId}`);
//   },

//   uploadRoomImages: (hotelId, roomTypeId, imageFiles) => {
//     const formData = new FormData();
//     Array.from(imageFiles).forEach((file) => {
//       formData.append("files", file);
//     });
//     return API.post(`/hotels/${hotelId}/room-types/${roomTypeId}/images`, formData, {
//       headers: { "Content-Type": "multipart/form-data" },
//     });
//   },

//   // --------------------------------------------------------
//   // MEAL PLANS
//   // --------------------------------------------------------
//   addMealPlan: (hotelId, mealData) => {
//     const mappedMeal = {
//       name:        mealData.name,
//       price:       mealData.price !== "" ? parseFloat(mealData.price) : 0,
//       description: mealData.description,
//     };
//     return API.post(`/hotels/${hotelId}/meal-plans`, mappedMeal);
//   },

//   updateMealPlan: (hotelId, mealPlanId, mealData) => {
//     const mappedMeal = {
//       name:        mealData.name,
//       price:       mealData.price !== "" ? parseFloat(mealData.price) : 0,
//       description: mealData.description,
//     };
//     return API.put(`/hotels/${hotelId}/meal-plans/${mealPlanId}`, mappedMeal);
//   },

//   deleteMealPlan: (hotelId, mealPlanId) => {
//     return API.delete(`/hotels/${hotelId}/meal-plans/${mealPlanId}`);
//   },
// };


import API from "@shared/api/http";
import { uploadImageViaApi } from "./imageUpload";

/**
 * Hotel image upload — backend-proxied (quota-enforced + metered).
 * Naam legacy hai (image aakhir Cloudinary pe hi jaati hai, bas backend ke through);
 * signature same rakhi hai taaki koi caller na toote.
 * Returns: secure_url (string) — yeh URL hotel ke imagePath mein save hota hai
 */
export function uploadHotelImageToCloudinary(file, onProgress) {
  return uploadImageViaApi("/hotels/upload-image", file, onProgress);
}

// ==========================================================
// 🌟 DATA TRANSFORMER: Frontend → Backend
// ==========================================================
function transformHotelData(frontendData) {
  return {
    // Basic Information
    name:          frontendData.name,
    destinationId: frontendData.destinationId
      ? parseInt(frontendData.destinationId)
      : null,
    city:          frontendData.city,
    stars:         frontendData.stars ? parseInt(frontendData.stars) : null,
    rating:        frontendData.rating
      ? parseFloat(frontendData.rating)
      : null,
    isDefault:     frontendData.isDefault ?? false,

    // Address & Location
    address:       frontendData.address,
    mapUrl:        frontendData.mapUrl,
    latitude:      frontendData.lat  ? parseFloat(frontendData.lat)  : null,
    longitude:     frontendData.lng  ? parseFloat(frontendData.lng)  : null,

    // Contact Information
    contactPerson: frontendData.contact,
    phone:         frontendData.phone,
    email:         frontendData.email,
    website:       frontendData.website,

    // Description & Amenities
    overview:      frontendData.overview,
    amenities:     frontendData.amenities ?? [],

    // ── IMAGE — Cloudinary secure_url (YEH NAYA ADD KIYA) ──
    imagePath:     frontendData.imagePath || null,

    // Room Types array
    roomTypes: (frontendData.roomTypes ?? []).map((room) => ({
      name:      room.name,
      size:      room.size,
      occupancy: room.occupancy ? parseInt(room.occupancy) : null,
      bedType:   room.bedType,
      description: room.description,
    })),

    // Meal Plans array
    mealPlans: (frontendData.mealPlans ?? []).map((meal) => ({
      name:        meal.name,
      price:       meal.price !== "" ? parseFloat(meal.price) : 0,
      description: meal.description,
    })),
  };
}

// ==========================================================
// 🌟 DATA TRANSFORMER: Backend → Frontend
// ==========================================================
export function transformHotelResponse(backendData) {
  return {
    // FIX: Safely fallback to hotelId or publicId if standard id is missing
    id:           backendData.id || backendData.hotelId || backendData.publicId,
    publicId:     backendData.publicId,
    name:         backendData.name,
    destinationId: backendData.destinationId?.toString() ?? "",
    city:         backendData.city,
    stars:        backendData.stars,
    rating:       backendData.rating?.toString() ?? "",
    isDefault:    backendData.isDefault ?? false,

    address:      backendData.address,
    mapUrl:       backendData.mapUrl,
    lat:          backendData.latitude?.toString()  ?? "",
    lng:          backendData.longitude?.toString() ?? "",

    contact:      backendData.contactPerson,
    phone:        backendData.phone,
    email:        backendData.email,
    website:      backendData.website,

    overview:     backendData.overview,
    amenities:    backendData.amenities ?? [],

    // ── IMAGE — backend se wapas le aao (imagePath ya imageUrl) ──
    imagePath:    backendData.imagePath ?? backendData.imageUrl ?? "",

    roomTypes: (backendData.roomTypes ?? []).map((room) => ({
      id:          room.id,
      name:        room.name,
      size:        room.size,
      occupancy:   room.occupancy?.toString() ?? "",
      bedType:     room.bedType,
      description: room.description,
    })),

    mealPlans: (backendData.mealPlans ?? []).map((meal) => ({
      id:          meal.id,
      name:        meal.name,
      price:       meal.price?.toString() ?? "",
      description: meal.description,
    })),
  };
}

export const hotelService = {
  /* 1. PAGED HOTEL LIST
     GET /api/hotels?page&size&sortBy&sortDir&q&destinationId&city&stars
     Returns the raw PagedApiResponse envelope: { data: [...], pagination: {...} }.

     Search and filters are SERVER-side on purpose. Filtering a single page in the browser
     would only ever search the rows that page happened to contain — the defect this replaced.
     Callers should drive this through `usePagedList` rather than calling it bare. */
  listHotels: ({ page = 0, size = 25, sortBy = "name", sortDir = "asc",
                 q, destinationId, city, stars } = {}) =>
    API.get("/hotels", {
      params: {
        page, size, sortBy, sortDir,
        q: q || undefined,
        destinationId: destinationId || undefined,
        city: city || undefined,
        stars: stars || undefined,
      },
    }),

  /* 1b. EVERY HOTEL, ALL PAGES DRAINED
     For the few screens that genuinely need the complete master list rather than a page —
     the quotation builder's hotel picker, which must be able to offer any hotel. Explicit and
     loop-bounded, so "fetch everything" is a deliberate choice at the call site instead of an
     accident of forgetting the page params. */
  fetchAllHotels: async ({ pageSize = 200, maxPages = 25, ...filters } = {}) => {
    const all = [];
    for (let page = 0; page < maxPages; page++) {
      const res  = await hotelService.listHotels({ ...filters, page, size: pageSize });
      const body = res?.data ?? {};
      all.push(...(Array.isArray(body.data) ? body.data : []));

      // hasNext is the SERVER's answer, so the loop ends exactly when the data does — 200 hotels
      // is one request, 250 is two, 1,000 is five. pageSize matches the backend's MAX_PAGE_SIZE,
      // so asking for more per page would just be clamped and change nothing.
      if (body?.pagination?.hasNext !== true) break;

      // maxPages is a runaway guard, not a business limit. If it ever actually bites, the picker
      // is silently incomplete — say so loudly rather than let it look like missing hotels.
      if (page === maxPages - 1) {
        console.warn(
          `[hotelService] fetchAllHotels stopped at the ${maxPages}-page guard ` +
          `(${all.length} of ${body?.pagination?.totalElements ?? "?"} hotels). Raise maxPages.`,
        );
      }
    }
    return all;
  },

  // Back-compat shim: same call shape as before, but no longer silently truncated at the
  // server default. Prefer listHotels (paged) or fetchAllHotels (complete) in new code.
  getAllHotels: (params = {}) => hotelService.listHotels({ size: 200, ...params }),

  // 2. GET HOTELS BY DESTINATION ID
  getHotelsByDestination: (destinationId, { page = 0, size = 200, sortBy = "name", sortDir = "asc" } = {}) => {
    return API.get(`/hotels/destination/${destinationId}`, {
      params: { page, size, sortBy, sortDir },
    });
  },

  // 3. GET HOTEL BY ID
  getHotelById: (id) => {
    return API.get(`/hotels/${id}`);
  },

  // 4. CREATE HOTEL — imagePath already form mein hai (Cloudinary se)
  createHotel: (formData) => {
    const mappedData = transformHotelData(formData);
    return API.post("/hotels", mappedData);
  },

  // 5. UPDATE HOTEL
  updateHotel: (id, formData) => {
    const mappedData = transformHotelData(formData);
    return API.put(`/hotels/${id}`, mappedData);
  },

  // 6. DELETE HOTEL
  deleteHotel: (id) => {
    return API.delete(`/hotels/${id}`);
  },

  // 7. SET DEFAULT HOTEL FOR DESTINATION
  setDefaultHotel: (destinationId, hotelId) => {
    return API.patch(`/hotels/${hotelId}/set-default`, { destinationId });
  },

  // --------------------------------------------------------
  // ROOM TYPES
  // --------------------------------------------------------
  addRoomType: (hotelId, roomData) => {
    const mappedRoom = {
      name:        roomData.name,
      size:        roomData.size,
      occupancy:   roomData.occupancy ? parseInt(roomData.occupancy) : null,
      bedType:     roomData.bedType,
      description: roomData.description,
    };
    return API.post(`/hotels/${hotelId}/room-types`, mappedRoom);
  },

  updateRoomType: (hotelId, roomTypeId, roomData) => {
    const mappedRoom = {
      name:        roomData.name,
      size:        roomData.size,
      occupancy:   roomData.occupancy ? parseInt(roomData.occupancy) : null,
      bedType:     roomData.bedType,
      description: roomData.description,
    };
    return API.put(`/hotels/${hotelId}/room-types/${roomTypeId}`, mappedRoom);
  },

  deleteRoomType: (hotelId, roomTypeId) => {
    return API.delete(`/hotels/${hotelId}/room-types/${roomTypeId}`);
  },

  uploadRoomImages: (hotelId, roomTypeId, imageFiles) => {
    const formData = new FormData();
    Array.from(imageFiles).forEach((file) => {
      formData.append("files", file);
    });
    return API.post(`/hotels/${hotelId}/room-types/${roomTypeId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // --------------------------------------------------------
  // MEAL PLANS
  // --------------------------------------------------------
  addMealPlan: (hotelId, mealData) => {
    const mappedMeal = {
      name:        mealData.name,
      price:       mealData.price !== "" ? parseFloat(mealData.price) : 0,
      description: mealData.description,
    };
    return API.post(`/hotels/${hotelId}/meal-plans`, mappedMeal);
  },

  updateMealPlan: (hotelId, mealPlanId, mealData) => {
    const mappedMeal = {
      name:        mealData.name,
      price:       mealData.price !== "" ? parseFloat(mealData.price) : 0,
      description: mealData.description,
    };
    return API.put(`/hotels/${hotelId}/meal-plans/${mealPlanId}`, mappedMeal);
  },

  deleteMealPlan: (hotelId, mealPlanId) => {
    return API.delete(`/hotels/${hotelId}/meal-plans/${mealPlanId}`);
  },
};