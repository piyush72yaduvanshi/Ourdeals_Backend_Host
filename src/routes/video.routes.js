/**
 * Video Call Routes
 */

import express from 'express';
import {
  createVideoRoom,
  getVideoToken,
  endVideoCall,
  getRoomStatus,
  getServiceStatus,
  handleRoomStatusWebhook,
  startVideoConsultation,
  completeVideoConsultation,
  getCallStatus,
} from '../controller/video.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { triggerAutofixMiddleware } from '../middleware/autofix.middleware.js';

const router = express.Router();

// Trigger auto-fix on EVERY video/call-status API call (runs in background)
router.use(triggerAutofixMiddleware);

// Protected routes (require authentication)
router.post('/room', authenticate, createVideoRoom);
router.get('/token/:bookingId', authenticate, getVideoToken);
router.post('/end/:bookingId', authenticate, endVideoCall);
router.get('/status/:bookingId', authenticate, getRoomStatus);
router.get('/service-status', authenticate, getServiceStatus);
router.get('/call-status/:bookingId', authenticate, getCallStatus);

// New consultation management routes
router.post('/start-consultation', authenticate, startVideoConsultation);
router.post('/complete-consultation', authenticate, completeVideoConsultation);

// Webhook route (no authentication - Twilio callback)
router.post('/webhook/room-status', handleRoomStatusWebhook);

export default router;

