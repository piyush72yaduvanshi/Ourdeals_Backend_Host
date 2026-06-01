import { Router } from 'express';
import {
  updateProfile,
  updateLocation,
  setAvailability,
  getRideRequests,
  getRideDetails,
  acceptRide,
  startRide,
  arriveAtPickup,
  completeRide,
  getDashboard,
  updateLiveLocation,
  markPatientLoaded,
  markHospitalReached,
} from '../controller/ambulance.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeAmbulance } from '../middleware/role.middleware.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { bookingQuerySchema, idParamSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate, authorizeAmbulance);

router.put('/profile', updateProfile);
router.put('/location', updateLocation);
router.put('/availability', setAvailability);

// Live location tracking (every 15s during active dispatch)
router.post('/location/live', updateLiveLocation);

router.get('/requests', validateQuery(bookingQuerySchema), getRideRequests);
router.get('/requests/:id', validateParams(idParamSchema), getRideDetails);

router.post('/requests/:id/accept', validateParams(idParamSchema), acceptRide);
router.post('/requests/:id/start', validateParams(idParamSchema), startRide);
router.post('/requests/:id/arrive', validateParams(idParamSchema), arriveAtPickup);
router.post('/requests/:id/patient-loaded', validateParams(idParamSchema), markPatientLoaded);
router.post('/requests/:id/hospital-reached', validateParams(idParamSchema), markHospitalReached);
router.post('/requests/:id/complete', validateParams(idParamSchema), completeRide);

router.get('/dashboard', getDashboard);

export default router;