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
} from '../controller/video.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/room', authenticate, createVideoRoom);
router.get('/token/:bookingId', authenticate, getVideoToken);
router.post('/end/:bookingId', authenticate, endVideoCall);
router.get('/status/:bookingId', authenticate, getRoomStatus);
router.get('/service-status', authenticate, getServiceStatus);

// New consultation management routes
router.post('/start-consultation', authenticate, startVideoConsultation);
router.post('/complete-consultation', authenticate, completeVideoConsultation);

// Webhook route (no authentication - Twilio callback)
router.post('/webhook/room-status', handleRoomStatusWebhook);

export default router;
