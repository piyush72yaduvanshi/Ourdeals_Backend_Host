import { Router } from 'express';

import {
  updateProfile,
  updateServices,
  setAvailability,
  getBookings,
  acceptBooking,
  startVisit,
  completeVisit,
  getDashboard,
  captureVitals,
  getVitals,
  updateLocation,
} from '../controller/nurse.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeNurse } from '../middleware/role.middleware.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { bookingQuerySchema, idParamSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate, authorizeNurse);

router.put('/profile', updateProfile);
router.put('/services', updateServices);
router.put('/availability', setAvailability);

router.get('/bookings', validateQuery(bookingQuerySchema), getBookings);

router.post('/bookings/:id/accept', validateParams(idParamSchema), acceptBooking);
router.post('/bookings/:id/start', validateParams(idParamSchema), startVisit);
router.post('/bookings/:id/vitals', validateParams(idParamSchema), captureVitals);
router.get('/bookings/:id/vitals', validateParams(idParamSchema), getVitals);
router.post('/bookings/:id/complete', validateParams(idParamSchema), completeVisit);

router.get('/dashboard', getDashboard);

router.put('/location', updateLocation);

export default router;