import { Router } from 'express';
import {
  createBookingWithDocuments,
  addDocumentsToBooking,
  getBookingDocuments,
  deleteBookingDocument,
  createRegularBooking,
  updateConsultationType,
} from '../controller/booking.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadDocuments, handleUploadError } from '../middleware/s3Upload.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Create regular booking (without documents)
 * POST /api/v1/bookings
 * 
 * JSON body:
 * - provider (required): Provider ID
 * - serviceType (required): doctor, nurse, ambulance, etc.
 * - scheduledTime: ISO date string
 * - price (required): Booking price
 * - location (required): Object with address and coordinates
 * - notes: Additional notes
 * - consultationType: VIDEO_CALL or PHONE_CALL
 * - timeSlot: Object with start and end time
 */
router.post('/', createRegularBooking);

/**
 * Create booking with medical documents
 * POST /api/v1/bookings/with-documents
 * 
 * Form-data fields:
 * - provider (required): Provider ID
 * - serviceType (required): doctor, nurse, ambulance, etc.
 * - scheduledTime: ISO date string
 * - price (required): Booking price
 * - location (required): JSON string or object with address and coordinates
 * - notes: Additional notes
 * - consultationType: VIDEO_CALL or PHONE_CALL
 * - timeSlot: JSON string or object with start and end time
 * - medicalReports[]: Array of medical report files (max 5)
 * - previousPrescriptions[]: Array of prescription files (max 5)
 * - otherDocuments[]: Array of other document files (max 5)
 * - documentDescription: Description for other documents
 */
router.post(
  '/with-documents',
  uploadDocuments.multiple('medicalReports', 5),
  uploadDocuments.multiple('previousPrescriptions', 5),
  uploadDocuments.multiple('otherDocuments', 5),
  handleUploadError,
  createBookingWithDocuments
);

/**
 * Add documents to existing booking
 * POST /api/v1/bookings/:bookingId/documents
 * 
 * Form-data fields:
 * - medicalReports[]: Array of medical report files
 * - previousPrescriptions[]: Array of prescription files
 * - otherDocuments[]: Array of other document files
 * - documentDescription: Description for other documents
 */
router.post(
  '/:bookingId/documents',
  uploadDocuments.multiple('medicalReports', 5),
  uploadDocuments.multiple('previousPrescriptions', 5),
  uploadDocuments.multiple('otherDocuments', 5),
  handleUploadError,
  addDocumentsToBooking
);

/**
 * Get booking documents with signed URLs
 * GET /api/v1/bookings/:bookingId/documents
 * 
 * Returns all documents with temporary signed URLs (valid for 1 hour)
 */
router.get('/:bookingId/documents', getBookingDocuments);

/**
 * Delete document from booking
 * DELETE /api/v1/bookings/:bookingId/documents/:documentType/:documentId
 * 
 * documentType: medicalReports, previousPrescriptions, or otherDocuments
 */
router.delete(
  '/:bookingId/documents/:documentType/:documentId',
  deleteBookingDocument
);

/**
 * Update booking consultation type
 * PUT /api/v1/bookings/:bookingId/consultation-type
 * 
 * JSON body:
 * - consultationType: 'in-person', 'video-call', or 'phone-call'
 */
router.put('/:bookingId/consultation-type', updateConsultationType);

export default router;
