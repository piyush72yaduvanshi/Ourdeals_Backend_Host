import { Router } from "express";
import {
  getPhysiotherapyServices,
  getAllPhysiotherapists,
  createBookingRequest,
  getNearbyRequests,
  submitOffer,
  rejectRequest,
  getBookingOffers,
  confirmOffer,
  updateBookingStatus,
  getPatientBookings,
  getPhysiotherapistBookings,
  getBookingById,
} from "../controller/physiotherapy.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = Router();

// 1. Public catalog & physiotherapist browse
router.get("/services", getPhysiotherapyServices);
router.get("/therapists", getAllPhysiotherapists);

// 2. Patient booking requests
router.post(
  "/requests",
  authenticate,
  authorize("patient"),
  createBookingRequest
);
router.post(
  "/request",
  authenticate,
  authorize("patient"),
  createBookingRequest
);

router.get(
  "/patient/bookings",
  authenticate,
  authorize("patient"),
  getPatientBookings
);

router.get(
  "/requests/:bookingId/offers",
  authenticate,
  authorize("patient", "admin"),
  getBookingOffers
);

router.post(
  "/requests/:bookingId/confirm-offer",
  authenticate,
  authorize("patient"),
  confirmOffer
);

// 3. Physiotherapist routes
router.get(
  "/provider/requests",
  authenticate,
  authorize("physiotherapist", "admin"),
  getNearbyRequests
);

router.post(
  "/requests/:bookingId/offer",
  authenticate,
  authorize("physiotherapist", "admin"),
  submitOffer
);

router.post(
  "/requests/:bookingId/reject",
  authenticate,
  authorize("physiotherapist", "admin"),
  rejectRequest
);

router.get(
  "/provider/bookings",
  authenticate,
  authorize("physiotherapist", "admin"),
  getPhysiotherapistBookings
);

// 4. Status update & Booking details
router.patch(
  "/requests/:bookingId/status",
  authenticate,
  updateBookingStatus
);

router.get(
  "/requests/:bookingId",
  authenticate,
  getBookingById
);

export default router;
