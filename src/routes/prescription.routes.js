import express from 'express';
import {
  getPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  updatePrescription,
} from '../controller/prescription.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

// Doctor routes
router.get(
  '/doctor/prescriptions',
  authenticate,
  authorize(['doctor']),
  getDoctorPrescriptions
);

router.patch(
  '/doctor/prescriptions/:id',
  authenticate,
  authorize(['doctor']),
  updatePrescription
);

// Patient routes
router.get(
  '/patient/prescriptions',
  authenticate,
  authorize(['patient']),
  getPatientPrescriptions
);

// Common routes
router.get(
  '/prescriptions/:id',
  authenticate,
  getPrescription
);

export default router;
