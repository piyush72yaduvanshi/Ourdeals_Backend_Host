import { Router } from "express";
import { authController } from "../controller/auth.controller.js";
import { validate } from "../middleware/validation.middleware.js";
import { registerSchema, loginSchema } from "../validators/schemas.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rate-limit.middleware.js";
import { uploadProfilePicture, uploadDocuments } from "../middleware/upload.middleware.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  uploadDocuments, // Handle profile picture and documents
  validate(registerSchema),
  authController.register,
);

router.post("/login", authLimiter, validate(loginSchema), authController.login);

router.post("/logout", authController.logout)

router.get("/me", authenticate, authController.getCurrentUser);

router.post("/logout-all", authenticate, authController.logoutAllDevices);
router.post("/refresh", authController.refreshToken);
router.post("/change-password", authenticate, authController.changePassword);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);
router.post("/device-token", authenticate, authController.updateDeviceToken);
router.get("/notifications", authenticate, authController.getNotifications);
router.get("/notifications/unread-count", authenticate, authController.getUnreadCount);
router.post("/notifications/read-all", authenticate, authController.markAllNotificationsRead);
router.post("/notifications/:id/read", authenticate, authController.markNotificationRead);
router.put("/profile", authenticate, uploadProfilePicture, authController.updateProfile);
router.delete("/profile/picture", authenticate, authController.deleteProfilePicture);

export default router;

