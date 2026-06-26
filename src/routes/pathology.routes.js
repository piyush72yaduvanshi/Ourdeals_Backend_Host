import { Router } from 'express';

import {
  updateProfile,
  updateTests,
  getBookings,
  getBookingDetails,
  acceptBooking,
  rejectBooking,
  scheduleSampleCollection,
  uploadReport as uploadReportController,
  getDashboard,
  updateBookingStatus,
} from '../controller/pathology.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizePathology } from '../middleware/role.middleware.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { bookingQuerySchema, idParamSchema } from '../validators/schemas.js';
import { uploadDocuments, handleUploadError } from '../middleware/s3Upload.middleware.js';

const router = Router();

router.use(authenticate, authorizePathology);

router.put('/profile', updateProfile);
router.put('/tests', updateTests);

router.get('/bookings', validateQuery(bookingQuerySchema), getBookings);
router.get('/bookings/:id', validateParams(idParamSchema), getBookingDetails);

router.post('/bookings/:id/accept', validateParams(idParamSchema), acceptBooking);
router.post('/bookings/:id/reject', validateParams(idParamSchema), rejectBooking);

router.post(
  '/bookings/:id/schedule',
  validateParams(idParamSchema),
  scheduleSampleCollection
);

// Upload pathology report - now using S3
router.post(
  '/bookings/:id/report',
  validateParams(idParamSchema),
  uploadDocuments.single('report'),
  handleUploadError,
  uploadReportController
);

router.put('/bookings/:id/status', validateParams(idParamSchema), updateBookingStatus);

router.get('/dashboard', getDashboard);

export default router;