import { Router } from 'express';

import {
  updateProfile,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getInventory,
  getOrders,
  getPendingOrders,
  acceptOrder,
  updateOrderStatus,
  updateStock,
  getDashboard,
} from '../controller/pharmacist.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';
import { authorizePharmacist } from '../middleware/role.middleware.js';
import {
  validate,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';

import {
  medicineSchema,
  bookingQuerySchema,
  inventoryQuerySchema,
  idParamSchema,
  updateBookingStatusSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(authenticate, authorizePharmacist);

router.put('/profile', updateProfile);

router.post('/medicines', validate(medicineSchema), addMedicine);

router.put(
  '/medicines/:id',
  validateParams(idParamSchema),
  updateMedicine
);

router.delete(
  '/medicines/:id',
  validateParams(idParamSchema),
  deleteMedicine
);

router.get(
  '/medicines',
  validateQuery(inventoryQuerySchema),
  getInventory
);

router.get(
  '/orders/pending',
  validateQuery(bookingQuerySchema),
  getPendingOrders
);

router.get(
  '/orders',
  validateQuery(bookingQuerySchema),
  getOrders
);

router.post(
  '/orders/:id/accept',
  validateParams(idParamSchema),
  acceptOrder
);

router.put(
  '/orders/:id/status',
  validateParams(idParamSchema),
  validate(updateBookingStatusSchema),
  updateOrderStatus
);

router.put(
  '/medicines/:id/stock',
  validateParams(idParamSchema),
  updateStock
);

router.get('/dashboard', getDashboard);

export default router;