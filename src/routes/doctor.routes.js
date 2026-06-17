import { Router } from 'express';

import {
  updateProfile,
  setAvailability,
  getAppointments,
  getAppointmentDetails,
  acceptAppointment,
  createPrescription,
  getDashboard,
  updateLocation,
  completeAppointment,
  markVideoCallCompleted,
  scheduleAppointment,
  uploadPrescriptionFile,
} from '../controller/doctor.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeDoctor } from '../middleware/role.middleware.js';
import { uploadPrescription } from '../middleware/upload.middleware.js';
import {
  validate,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';

import {
  availabilitySchema,
  bookingQuerySchema,
  idParamSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate, authorizeDoctor);

router.put('/profile', updateProfile);

router.put('/availability', validate(availabilitySchema), setAvailability);

router.get('/appointments', validateQuery(bookingQuerySchema), getAppointments);

router.get('/appointments/:id', validateParams(idParamSchema), getAppointmentDetails);

router.post('/appointments/:id/accept', validateParams(idParamSchema), acceptAppointment);

router.post('/appointments/:id/complete', validateParams(idParamSchema), completeAppointment);

router.post('/appointments/:id/video-completed', validateParams(idParamSchema), markVideoCallCompleted);

router.post('/appointments/:id/schedule', validateParams(idParamSchema), scheduleAppointment);

router.post(
  '/appointments/:id/prescription-file',
  validateParams(idParamSchema),
  uploadPrescription,
  uploadPrescriptionFile,
);

router.post('/prescriptions', createPrescription);

router.get('/dashboard', getDashboard);

router.put('/location', updateLocation);

export default router;