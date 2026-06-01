import { Router } from 'express';

import {
  updateProfile,
  getStock,
  updateStock,
  getRequests,
  acceptRequest,
  fulfillRequest,
  cancelRequest, // Add cancel import
  getDashboard,
} from '../controller/bloodbank.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeBloodBank } from '../middleware/role.middleware.js';
import {
  validate,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';

import {
  bloodStockSchema,
  bookingQuerySchema,
  idParamSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate, authorizeBloodBank);

router.put('/profile', updateProfile);
router.get('/stock', getStock);
router.put('/stock', validate(bloodStockSchema), updateStock);

router.get('/requests', validateQuery(bookingQuerySchema), getRequests);

router.post('/requests/:id/accept', validateParams(idParamSchema), acceptRequest);
router.post('/requests/:id/fulfill', validateParams(idParamSchema), fulfillRequest);
router.post('/requests/:id/cancel', validateParams(idParamSchema), cancelRequest); // Add cancel route

router.get('/dashboard', getDashboard);

export default router;