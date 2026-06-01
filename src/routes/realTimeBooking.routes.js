import { Router } from "express";
import {
  createBookingRequest,
  acceptBookingRequest,
  updateStatus,
  cancelBooking,
  getBookingDetails,
  getMyBookings,
  getPatientDashboard,
  getProviderBookings,
  getProviderDashboard,
  markAsViewed,
} from "../controller/realTimeBooking.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();

// Patient routes
router.post(
  "/create",
  authenticate,
  authorize("patient"),
  createBookingRequest
);

router.get(
  "/my-bookings",
  authenticate,
  authorize("patient"),
  getMyBookings
);

router.get(
  "/patient/dashboard",
  authenticate,
  authorize("patient"),
  getPatientDashboard
);

// Provider routes
router.post(
  "/:bookingId/accept",
  authenticate,
  authorize("doctor", "nurse", "ambulance", "pharmacist", "bloodbank", "pathology"),
  acceptBookingRequest
);

router.patch(
  "/:bookingId/status",
  authenticate,
  authorize("doctor", "nurse", "ambulance", "pharmacist", "bloodbank", "pathology"),
  updateStatus
);

router.get(
  "/provider/bookings",
  authenticate,
  authorize("doctor", "nurse", "ambulance", "pharmacist", "bloodbank", "pathology"),
  getProviderBookings
);

router.get(
  "/provider/dashboard",
  authenticate,
  authorize("doctor", "nurse", "ambulance", "pharmacist", "bloodbank", "pathology"),
  getProviderDashboard
);

router.patch(
  "/:bookingId/viewed",
  authenticate,
  authorize("doctor", "nurse", "ambulance", "pharmacist", "bloodbank", "pathology"),
  markAsViewed
);

// Common routes (both patient and provider)
router.get(
  "/:bookingId",
  authenticate,
  getBookingDetails
);

router.post(
  "/:bookingId/cancel",
  authenticate,
  cancelBooking
);

export default router;
