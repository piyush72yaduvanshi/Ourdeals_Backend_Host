import { Router } from "express";
import {
  getDashboard,
  getPendingApprovals,
  approveProvider,
  rejectProvider,
  blockUser,
  unblockUser,
  getAllUsers,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getAllMedicines,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
  getAllAmbulances,
  updateBloodStock,
  getAllBloodBanks,
  updatePathologyTests,
  getAllPathologyLabs,
  getServiceStats,
  getAllBookings,
  getBookingAnalytics,
  getUserDocuments,
} from "../controller/admin.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeAdmin } from "../middleware/role.middleware.js";
import { validateParams, validate } from "../middleware/validation.middleware.js";
import { idParamSchema, medicineSchema, bloodStockUpdateSchema, ambulanceSchema, pathologyTestSchema } from "../validators/schemas.js";
import { uploadMedicineImage, uploadMedicineImages } from "../middleware/upload.middleware.js";

const router = Router();

// Admin auth + role guard
router.use(authenticate, authorizeAdmin);

// Dashboard
router.get("/dashboard", getDashboard);

// Provider approvals
router.get("/approvals/pending", getPendingApprovals);

router.post(
  "/providers/:id/approve",
  validateParams(idParamSchema),
  approveProvider
);

router.post(
  "/providers/:id/reject",
  validateParams(idParamSchema),
  rejectProvider
);

// User management
router.post(
  "/users/:id/block",
  validateParams(idParamSchema),
  blockUser
);

router.post(
  "/users/:id/unblock",
  validateParams(idParamSchema),
  unblockUser
);

router.get("/users", getAllUsers);

// Get user documents
router.get(
  "/users/:userId/documents",
  validateParams(idParamSchema),
  getUserDocuments
);

// ==================== MEDICINE MANAGEMENT ====================
router.post(
  "/medicines",
  uploadMedicineImages,
  validate(medicineSchema),
  createMedicine
);

router.put(
  "/medicines/:id",
  validateParams(idParamSchema),
  uploadMedicineImages,
  updateMedicine
);

router.delete(
  "/medicines/:id",
  validateParams(idParamSchema),
  deleteMedicine
);

router.get("/medicines", getAllMedicines);

// ==================== AMBULANCE MANAGEMENT ====================
router.post(
  "/ambulances",
  validate(ambulanceSchema),
  createAmbulance
);

router.put(
  "/ambulances/:id",
  validateParams(idParamSchema),
  validate(ambulanceSchema),
  updateAmbulance
);

router.delete(
  "/ambulances/:id",
  validateParams(idParamSchema),
  deleteAmbulance
);

router.get("/ambulances", getAllAmbulances);

// ==================== BLOOD BANK MANAGEMENT ====================
router.put(
  "/bloodbanks/:id/stock",
  validateParams(idParamSchema),
  validate(bloodStockUpdateSchema),
  updateBloodStock
);

router.get("/bloodbanks", getAllBloodBanks);

// ==================== PATHOLOGY MANAGEMENT ====================
router.put(
  "/pathology/:id/tests",
  validateParams(idParamSchema),
  validate(pathologyTestSchema),
  updatePathologyTests
);

router.get("/pathology", getAllPathologyLabs);

// ==================== ANALYTICS & REPORTS ====================
router.get("/stats/services", getServiceStats);

export default router;
