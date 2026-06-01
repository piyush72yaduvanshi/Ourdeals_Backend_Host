import { Router } from "express";
import {
  uploadDocuments,
  getMyDocuments,
  deleteDocument,
  getDocumentDownloadUrl,
  verifyDocument,
} from "../controller/document.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";
import { uploadDocuments as uploadMiddleware, handleUploadError } from "../middleware/s3Upload.middleware.js";
import { uploadLimiter } from "../middleware/rate-limit.middleware.js";

const router = Router();

// User routes - Upload documents based on role
router.post(
  "/upload/doctor",
  authenticate,
  authorize("doctor"),
  uploadLimiter,
  uploadMiddleware.doctor,
  handleUploadError,
  uploadDocuments
);

router.post(
  "/upload/nurse",
  authenticate,
  authorize("nurse"),
  uploadLimiter,
  uploadMiddleware.nurse,
  handleUploadError,
  uploadDocuments
);

router.post(
  "/upload/pathology",
  authenticate,
  authorize("pathology"),
  uploadLimiter,
  uploadMiddleware.pathology,
  handleUploadError,
  uploadDocuments
);

router.post(
  "/upload/ambulance",
  authenticate,
  authorize("ambulance"),
  uploadLimiter,
  uploadMiddleware.ambulance,
  handleUploadError,
  uploadDocuments
);

router.post(
  "/upload/bloodbank",
  authenticate,
  authorize("bloodbank"),
  uploadLimiter,
  uploadMiddleware.bloodbank,
  handleUploadError,
  uploadDocuments
);

router.post(
  "/upload/pharmacist",
  authenticate,
  authorize("pharmacist"),
  uploadLimiter,
  uploadMiddleware.pharmacist,
  handleUploadError,
  uploadDocuments
);

// Get my documents
router.get(
  "/my-documents",
  authenticate,
  getMyDocuments
);

// Delete document
router.delete(
  "/:fieldName",
  authenticate,
  deleteDocument
);

// Get download URL
router.get(
  "/download/:fieldName",
  authenticate,
  getDocumentDownloadUrl
);

// Admin routes - Verify documents
router.patch(
  "/verify/:userId/:fieldName",
  authenticate,
  authorize("admin"),
  verifyDocument
);

export default router;
