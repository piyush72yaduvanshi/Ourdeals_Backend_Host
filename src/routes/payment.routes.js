import express from 'express';
import {
  createOrder,
  verifyPayment,
  setupVendorBankDetails,
  getPaymentDetails,
  releasePayout,
} from '../controller/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';
import { validate, validateParams } from '../middleware/validation.middleware.js';
import { idempotencyMiddleware } from '../middleware/idempotency.middleware.js';
import { paymentLimiter } from '../middleware/rate-limit.middleware.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  bankDetailsSchema,
  releasePayoutSchema,
  idParamSchema,
} from '../validators/schemas.js';

const router = express.Router();

// FIXED: Import paymentLimiter directly instead of rateLimiters.payment
// FIXED: Import idempotencyMiddleware instead of idempotency
// FIXED: Use validateParams instead of validate(schema, 'params')

// Patient routes
router.post('/create-order', authenticate, paymentLimiter, validate(createOrderSchema), createOrder);
router.post('/verify', authenticate, paymentLimiter, idempotencyMiddleware, validate(verifyPaymentSchema), verifyPayment);
router.get('/:id', authenticate, validateParams(idParamSchema), getPaymentDetails);

// Vendor routes
router.post(
  '/vendor/bank-details',
  authenticate,
  authorize(['doctor', 'nurse', 'ambulance', 'pharmacist', 'bloodbank', 'pathology']),
  validate(bankDetailsSchema),
  setupVendorBankDetails
);

// Admin routes
router.post(
  '/release-payout',
  authenticate,
  authorize(['admin']),
  validate(releasePayoutSchema),
  releasePayout
);

export default router;
