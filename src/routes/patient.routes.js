import { Router } from "express";

import {
  getNearbyServices,
  createBooking,
  getBookings,
  getActiveBookings,
  getBookingDetails,
  cancelBooking,
  addRating,
  triggerEmergency,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  searchDoctors,
  searchNurses,
  searchAmbulances,
  searchMedicines,
  searchPharmacies,
  searchPathologyLabs,
  searchBloodBanks,
  globalSearch,
  getNurseDetails,
  getAmbulanceDetails,
  getNurseAvailability,
  getMedicineById,
} from "../controller/patient.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizePatient } from "../middleware/role.middleware.js";
import {
  validate,
  validateQuery,
  validateParams,
} from "../middleware/validation.middleware.js";

import {
  createBookingSchema,
  locationQuerySchema,
  ratingSchema,
  bookingQuerySchema,
  paginationSchema,
  emergencySchema,
  idParamSchema,
} from "../validators/schemas.js";

import { emergencyLimiter } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.use(authenticate, authorizePatient);

router.get(
  "/services/nearby",
  validateQuery(locationQuerySchema),
  getNearbyServices,
);

router.post("/bookings", validate(createBookingSchema), createBooking);

router.get("/bookings", validateQuery(bookingQuerySchema), getBookings);

router.get("/bookings/active", getActiveBookings);

router.get("/bookings/:id", validateParams(idParamSchema), getBookingDetails);

router.post(
  "/bookings/:id/cancel",
  validateParams(idParamSchema),
  cancelBooking,
);

router.post(
  "/bookings/:id/rate",
  validateParams(idParamSchema),
  validate(ratingSchema),
  addRating,
);

router.post("/emergency", emergencyLimiter, triggerEmergency);

router.get("/notifications", validateQuery(paginationSchema), getNotifications);

router.post(
  "/notifications/:id/read",
  validateParams(idParamSchema),
  markNotificationRead,
);

router.get("/notifications/unread-count", getUnreadCount);

// ==================== SEARCH ENDPOINTS ====================
router.get("/search", globalSearch);
router.get("/search/doctors", searchDoctors);
router.get("/search/nurses", searchNurses);
router.get("/search/ambulances", searchAmbulances);
router.get("/search/medicines", searchMedicines);
router.get("/search/pharmacies", searchPharmacies);
router.get("/search/labs", searchPathologyLabs);
router.get("/search/bloodbanks", searchBloodBanks);

// ==================== DETAIL ENDPOINTS ====================
router.get("/nurses/:id", validateParams(idParamSchema), getNurseDetails);
router.get("/nurses/:id/availability", validateParams(idParamSchema), getNurseAvailability);
router.get("/ambulances/:id", validateParams(idParamSchema), getAmbulanceDetails);
router.get("/medicines/:id", validateParams(idParamSchema), getMedicineById);

export default router;
