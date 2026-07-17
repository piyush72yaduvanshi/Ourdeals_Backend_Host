/**
 * Video Call Controller
 * Handles video consultation endpoints (Zoom)
 */

import { zoomService } from '../services/zoom.service.js';
import { Booking } from '../models/Booking.model.js';
import { Doctor } from '../models/Doctor.model.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';
import { getSocketHandler } from '../socket/socket.handler.js';

/**
 * Create video room for consultation (Zoom)
 */
const createVideoRoom = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.userId;

    // Verify booking exists and user is part of it
    let booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate({
        path: 'provider',
        select: 'firstName lastName consultationTypes specialization role',
        model: 'User' // Explicitly specify the model
      });

    let isRealTime = false;
    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId)
        .populate('patient', 'firstName lastName')
        .populate({
          path: 'acceptedProvider',
          select: 'firstName lastName consultationTypes specialization role',
          model: 'User'
        });
      if (booking) {
        isRealTime = true;
        // Map acceptedProvider to provider for compatibility with rest of the code
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check if user is patient or provider
    const isPatient = booking.patient._id.toString() === userId;
    const isProvider = booking.provider._id.toString() === userId;

    if (!isPatient && !isProvider) {
      return res.status(403).json(errorResponse('Not authorized to access this consultation'));
    }

    // Skip consultationType validation/conversion as all doctors support video

    // Check booking status - allow requested (auto-accept), accepted, and in_progress
    if (!['requested', 'accepted', 'in_progress'].includes(booking.status)) {
      return res.status(400).json(errorResponse('Consultation not ready. Status: ' + booking.status));
    }

    // Auto-accept if still in requested status
    if (booking.status === 'requested') {
      booking.status = 'accepted';
      try { await booking.save(); } catch(e) { logger.warn('Could not auto-accept booking:', e.message); }
    }

    // Create or get existing Zoom meeting
    let session;
    if (booking.zoomMeetingId) {
      // Meeting already exists, generate new tokens
      const role = isProvider ? 1 : 0; // 1 for host (doctor), 0 for participant (patient)
      const token = zoomService.generateSDKJWT(booking.zoomMeetingId, role);
      
      session = {
        meetingId: booking.zoomMeetingId,
        meetingPassword: booking.zoomMeetingPassword,
        token,
        sdkKey: zoomService.clientId,
        role: isProvider ? 'host' : 'participant',
        joinUrl: booking.zoomJoinUrl,
      };
    } else {
      // Create new Zoom meeting
      const doctorName = `${booking.provider.firstName} ${booking.provider.lastName}`;
      const patientName = `${booking.patient.firstName} ${booking.patient.lastName}`;
      
      session = await zoomService.createConsultationSession(bookingId, doctorName, patientName);
      
      // Save meeting details to booking
      booking.zoomMeetingId = session.meetingId;
      booking.zoomMeetingPassword = session.meetingPassword;
      booking.zoomJoinUrl = session.joinUrl;
      booking.zoomHostStartUrl = session.hostStartUrl;
      await booking.save();
    }

    // Return appropriate token based on role
    const role = isProvider ? 'host' : 'participant';
    const token = isProvider ? session.hostToken || session.token : session.participantToken || session.token;

    // If patient is joining, mark patient_on_call
    if (isPatient && !booking.patient_on_call) {
      booking.patient_on_call = true;
      await booking.save();

      // Emit WebSocket event for real-time tracking
      try {
        const socketHandler = getSocketHandler();
        socketHandler.emitToBooking(bookingId, 'call:patient_joined', {
          bookingId,
          patient_on_call: true,
          timestamp: new Date(),
        });
      } catch (e) { /* socket may not be initialized */ }
    }

    logger.info(`Zoom meeting access granted for ${role}: ${userId} in booking: ${bookingId}`);

    // Format scheduled time for display
    const scheduledTimeFormatted = booking.scheduledTime ? 
      new Date(booking.scheduledTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null;

    // Format time slot if available
    const timeSlotFormatted = booking.timeSlot ? 
      `${booking.timeSlot.start} - ${booking.timeSlot.end}` : null;

    res.json(successResponse('Video room ready', {
      meetingId: session.meetingId,
      meetingPassword: session.meetingPassword,
      token,
      sdkKey: session.sdkKey,
      role,
      joinUrl: session.joinUrl,
      startUrl: isProvider ? session.hostStartUrl : undefined,
      expiresIn: session.expiresIn || 7200,
      participants: {
        patient: {
          id: booking.patient._id,
          name: `${booking.patient.firstName} ${booking.patient.lastName}`,
        },
        doctor: {
          id: booking.provider._id,
          name: `${booking.provider.firstName} ${booking.provider.lastName}`,
        },
      },
      appointmentDetails: {
        scheduledTime: scheduledTimeFormatted,
        timeSlot: timeSlotFormatted,
        consultationType: booking.consultationType,
        status: booking.status,
        bookingId: booking._id,
        duration: booking.duration || 30, // Default 30 minutes
      },
    }));
  } catch (error) {
    logger.error('Create video room error', { error: error.message });
    res.status(500).json(errorResponse(error.message || 'Failed to create video room'));
  }
};

/**
 * Get video room token (refresh token for Zoom)
 */
const getVideoToken = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    // Verify booking
    let booking = await Booking.findById(bookingId);

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId);
      if (booking) {
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check authorization
    const isPatient = booking.patient.toString() === userId;
    const isProvider = booking.provider.toString() === userId;

    if (!isPatient && !isProvider) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    if (!booking.zoomMeetingId) {
      return res.status(400).json(errorResponse('No Zoom meeting created yet'));
    }

    // Generate new token
    const role = isProvider ? 1 : 0; // 1 for host, 0 for participant
    const token = zoomService.generateSDKJWT(booking.zoomMeetingId, role);

    res.json(successResponse('Token generated', {
      token,
      meetingId: booking.zoomMeetingId,
      sdkKey: zoomService.clientId,
      role: isProvider ? 'host' : 'participant',
      expiresIn: 7200,
    }));
  } catch (error) {
    logger.error('Get video token error', { error: error.message });
    res.status(500).json(errorResponse(error.message || 'Failed to generate token'));
  }
};

/**
 * End video consultation (Zoom)
 */
const endVideoCall = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    // Verify booking
    let booking = await Booking.findById(bookingId);

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId);
      if (booking) {
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Only provider can end the call
    if (booking.provider.toString() !== userId) {
      return res.status(403).json(errorResponse('Only provider can end the consultation'));
    }

    // Delete the Zoom meeting if it exists
    if (booking.zoomMeetingId) {
      try {
        await zoomService.deleteMeeting(booking.zoomMeetingId);
      } catch (error) {
        logger.warn(`Failed to delete Zoom meeting: ${error.message}`);
        // Continue even if deletion fails
      }
    }

    // Mark video call as completed and consultation as ended
    const now = new Date();
    booking.videoCallEndedAt = now;
    booking.videoCallCompleted = true;
    booking.doctor_on_call = false;
    booking.patient_on_call = false;
    booking.consultation_ended = true;
    booking.consultation_ended_at = now;
    await booking.save();

    // Emit WebSocket event for instant notification
    try {
      const socketHandler = getSocketHandler();
      socketHandler.emitToBooking(bookingId, 'call:consultation_ended', {
        bookingId,
        consultation_ended: true,
        consultation_ended_at: now,
        status: booking.status,
        timestamp: now,
      });
    } catch (e) { /* socket may not be initialized */ }

    logger.info(`Video consultation ended for booking: ${bookingId}`);

    res.json(successResponse('Video consultation ended', {
      bookingId,
      status: booking.status,
      videoCallCompleted: true,
    }));
  } catch (error) {
    logger.error('End video call error', { error: error.message });
    res.status(500).json(errorResponse(error.message || 'Failed to end video call'));
  }
};

/**
 * Get video room status (Zoom)
 */
const getRoomStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    // Verify booking
    let booking = await Booking.findById(bookingId);

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId);
      if (booking) {
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check authorization
    const isPatient = booking.patient.toString() === userId;
    const isProvider = booking.provider.toString() === userId;

    if (!isPatient && !isProvider) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    if (!booking.zoomMeetingId) {
      return res.json(successResponse('No video room created yet', {
        roomExists: false,
        bookingStatus: booking.status,
        consultationType: booking.consultationType,
      }));
    }

    // Try to get meeting details from Zoom
    try {
      const meeting = await zoomService.getMeeting(booking.zoomMeetingId);
      
      res.json(successResponse('Room status fetched', {
        roomExists: true,
        meetingId: meeting.id,
        status: meeting.status || 'waiting',
        joinUrl: booking.zoomJoinUrl,
        bookingStatus: booking.status,
        consultationType: booking.consultationType,
        meetingDetails: meeting,
      }));
    } catch (zoomError) {
      logger.warn(`Failed to get Zoom meeting details: ${zoomError.message}`, {
        bookingId,
        meetingId: booking.zoomMeetingId,
      });
      
      // Return booking info even if Zoom API fails
      res.json(successResponse('Room exists but status unavailable', {
        roomExists: true,
        meetingId: booking.zoomMeetingId,
        status: 'unknown',
        joinUrl: booking.zoomJoinUrl,
        bookingStatus: booking.status,
        consultationType: booking.consultationType,
        warning: 'Could not fetch live meeting status from Zoom',
      }));
    }
  } catch (error) {
    logger.error('Get room status error', { error: error.message });
    res.status(500).json(errorResponse(error.message || 'Failed to get room status'));
  }
};

/**
 * Get video service status (Zoom)
 */
const getServiceStatus = async (req, res) => {
  try {
    const status = zoomService.getStatus();
    res.json(successResponse('Video service status', status));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to get service status'));
  }
};

/**
 * Webhook handler for Twilio room status callbacks
 */
const handleRoomStatusWebhook = async (req, res) => {
  try {
    const { RoomSid, RoomName, RoomStatus, StatusCallbackEvent } = req.body;

    logger.info('Twilio webhook received', {
      roomSid: RoomSid,
      roomName: RoomName,
      status: RoomStatus,
      event: StatusCallbackEvent,
    });

    // Update booking if room ended
    if (StatusCallbackEvent === 'room-ended' || RoomStatus === 'completed') {
      const booking = await Booking.findById(RoomName);
      if (booking && booking.status !== 'completed') {
        booking.status = 'completed';
        booking.completedAt = new Date();
        await booking.save();
        logger.info(`Booking ${RoomName} marked as completed via webhook`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook handler error', { error: error.message });
    res.status(500).send('Error');
  }
};

/**
 * Start video consultation - Auto-complete appointment when vendor starts video call
 * POST /video/start-consultation
 */
const startVideoConsultation = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.userId;

    // Verify booking exists and user is the provider
    let booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate('provider', 'firstName lastName role');

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId)
        .populate('patient', 'firstName lastName')
        .populate({
          path: 'acceptedProvider',
          select: 'firstName lastName role',
          model: 'User'
        });
      if (booking) {
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Only healthcare providers can start consultations
    const isProvider = booking.provider._id.toString() === userId;
    if (!isProvider) {
      return res.status(403).json(errorResponse('Only healthcare providers can start consultations'));
    }

    // Check if booking is ready for consultation
    if (!['requested', 'accepted', 'in_progress'].includes(booking.status)) {
      return res.status(400).json(errorResponse(`Cannot start consultation. Current status: ${booking.status}`));
    }

    // Update booking status to in_progress, set start time, and mark doctor on call
    const now = new Date();
    booking.status = 'in_progress';
    booking.startTime = now;
    booking.meetingStartTime = now;
    booking.doctor_on_call = true;
    booking.consultation_ended = false;

    // If no end time is set, calculate it based on duration or default to 30 minutes
    if (!booking.endTime) {
      const durationMinutes = booking.duration || 30;
      booking.endTime = new Date(now.getTime() + (durationMinutes * 60 * 1000));
    }

    await booking.save();

    // Emit WebSocket event for real-time tracking
    try {
      const socketHandler = getSocketHandler();
      socketHandler.emitToBooking(bookingId, 'call:doctor_joined', {
        bookingId,
        doctor_on_call: true,
        status: 'in_progress',
        timestamp: now,
      });
    } catch (e) { /* socket may not be initialized */ }

    logger.info(`Video consultation started by provider ${userId} for booking ${bookingId}`, {
      bookingId,
      providerId: userId,
      patientId: booking.patient._id,
      startTime: booking.startTime,
      estimatedEndTime: booking.endTime,
    });

    // Format appointment details for response
    const scheduledTimeFormatted = booking.scheduledTime ? 
      new Date(booking.scheduledTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null;

    const timeSlotFormatted = booking.timeSlot ? 
      `${booking.timeSlot.start} - ${booking.timeSlot.end}` : null;

    res.json(successResponse('Video consultation started successfully', {
      bookingId: booking._id,
      status: booking.status,
      startTime: booking.startTime,
      estimatedEndTime: booking.endTime,
      meetingStartTime: booking.meetingStartTime,
      appointmentDetails: {
        scheduledTime: scheduledTimeFormatted,
        timeSlot: timeSlotFormatted,
        consultationType: booking.consultationType,
        duration: booking.duration || 30,
      },
      participants: {
        patient: {
          id: booking.patient._id,
          name: `${booking.patient.firstName} ${booking.patient.lastName}`,
        },
        provider: {
          id: booking.provider._id,
          name: `${booking.provider.firstName} ${booking.provider.lastName}`,
          role: booking.provider.role,
        },
      },
      message: 'Consultation is now in progress. Appointment will be auto-completed when video call ends.',
    }));

  } catch (error) {
    logger.error('Start video consultation error', { error: error.message, bookingId: req.body.bookingId });
    res.status(500).json(errorResponse(error.message || 'Failed to start video consultation'));
  }
};

/**
 * Complete video consultation - Mark appointment as completed
 * POST /video/complete-consultation
 */
const completeVideoConsultation = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.userId;

    // Verify booking exists and user is the provider
    let booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate('provider', 'firstName lastName role');

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId)
        .populate('patient', 'firstName lastName')
        .populate({
          path: 'acceptedProvider',
          select: 'firstName lastName role',
          model: 'User'
        });
      if (booking) {
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Only healthcare providers can complete consultations
    const isProvider = booking.provider._id.toString() === userId;
    if (!isProvider) {
      return res.status(403).json(errorResponse('Only healthcare providers can complete consultations'));
    }

    // Check if consultation is in progress
    if (booking.status !== 'in_progress') {
      return res.status(400).json(errorResponse(`Cannot complete consultation. Current status: ${booking.status}`));
    }

    // Update booking status to completed and set end time
    const now = new Date();
    booking.status = 'completed';
    booking.endTime = now;
    booking.meetingEndTime = now;
    booking.doctor_on_call = false;
    booking.patient_on_call = false;
    booking.consultation_ended = true;
    booking.consultation_ended_at = now;
    booking.videoCallCompleted = true;

    // Calculate actual duration
    if (booking.startTime) {
      booking.duration = Math.round((now - booking.startTime) / (1000 * 60)); // minutes
    }

    await booking.save();

    // Delete the Zoom meeting if it exists
    if (booking.zoomMeetingId) {
      try {
        await zoomService.deleteMeeting(booking.zoomMeetingId);
      } catch (error) {
        logger.warn(`Failed to delete Zoom meeting on complete: ${error.message}`);
      }
    }

    // Emit WebSocket event for instant notification to both parties
    try {
      const socketHandler = getSocketHandler();
      socketHandler.emitToBooking(bookingId, 'call:consultation_ended', {
        bookingId,
        consultation_ended: true,
        consultation_ended_at: now,
        status: 'completed',
        duration: booking.duration,
        timestamp: now,
      });
    } catch (e) { /* socket may not be initialized */ }

    logger.info(`Video consultation completed by provider ${userId} for booking ${bookingId}`, {
      bookingId,
      providerId: userId,
      patientId: booking.patient._id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      actualDuration: booking.duration,
    });

    res.json(successResponse('Video consultation completed successfully', {
      bookingId: booking._id,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      actualDuration: booking.duration,
      completedAt: now,
      participants: {
        patient: {
          id: booking.patient._id,
          name: `${booking.patient.firstName} ${booking.patient.lastName}`,
        },
        provider: {
          id: booking.provider._id,
          name: `${booking.provider.firstName} ${booking.provider.lastName}`,
          role: booking.provider.role,
        },
      },
      message: 'Consultation completed successfully. Thank you for using OnMint Healthcare.',
    }));

  } catch (error) {
    logger.error('Complete video consultation error', { error: error.message, bookingId: req.body.bookingId });
    res.status(500).json(errorResponse(error.message || 'Failed to complete video consultation'));
  }
};

/**
 * Get real-time call status for a booking
 * GET /video/call-status/:bookingId
 * 
 * IMPORTANT: Always fetches fresh data from database (no caching)
 * to ensure prescription updates are reflected immediately
 */
const getCallStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;

    logger.info('\n════════════════════════════════════════════════════════');
    logger.info('📹 VIDEO API: GET CALL STATUS');
    logger.info('════════════════════════════════════════════════════════');
    logger.info(`🔍 Booking ID: ${bookingId}`);
    logger.info(`👤 User ID: ${userId}`);
    logger.info(`⏰ Timestamp: ${new Date().toISOString()}`);

    // IMPORTANT: Use read preference 'primary' for REAL-TIME fresh data
    // This ensures we get the latest data instantly after prescription upload
    let booking = await Booking.findById(bookingId)
      .read('primary') // Force read from PRIMARY database (no cache, no replica lag)
      .select('doctor_on_call patient_on_call consultation_ended consultation_ended_at status videoCallCompleted prescription')
      .populate({
        path: 'prescription',
        select: 'prescriptionFile diagnosis medicines advice notes followUpDate createdAt updatedAt',
      })
      .lean();

    if (booking) {
      logger.info('✅ Found in Booking collection');
    } else {
      logger.info('⚠️  Not found in Booking, trying RealTimeBooking...');
    }

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(bookingId)
        .read('primary') // Force read from PRIMARY database for INSTANT real-time data
        .select('doctor_on_call patient_on_call consultation_ended consultation_ended_at status videoCallCompleted acceptedProvider patient prescription')
        .populate({
          path: 'prescription',
          select: 'prescriptionFile diagnosis medicines advice notes followUpDate createdAt updatedAt',
        })
        .lean();
      if (booking) {
        logger.info('✅ Found in RealTimeBooking collection');
        booking.provider = booking.acceptedProvider;
      }
    }

    if (!booking) {
      logger.error('❌ Booking not found');
      return res.status(404).json(errorResponse('Booking not found'));
    }

    logger.info(`📋 Booking Status: ${booking.status}`);
    logger.info(`📹 Video Call Completed: ${booking.videoCallCompleted || false}`);
    logger.info(`💊 Has Prescription: ${!!booking.prescription}`);

    // Build response
    const response = {
      bookingId,
      doctor_on_call: booking.doctor_on_call || false,
      patient_on_call: booking.patient_on_call || false,
      consultation_ended: booking.consultation_ended || false,
      consultation_ended_at: booking.consultation_ended_at,
      status: booking.status,
      videoCallCompleted: booking.videoCallCompleted || false,
    };

    logger.info('────────────────────────────────────────────────────────');
    logger.info('💊 PRESCRIPTION PROCESSING');
    logger.info('────────────────────────────────────────────────────────');

    // Add prescription data if available
    if (booking.prescription) {
      logger.info('✅ Prescription exists');
      logger.info(`   Prescription ID: ${booking.prescription._id}`);
      
      if (booking.prescription.prescriptionFile) {
        logger.info(`   Original URL: ${booking.prescription.prescriptionFile}`);
        
        try {
          const url = new URL(booking.prescription.prescriptionFile);
          const cleanUrl = `${url.protocol}//${url.host}${url.pathname}`;
          response.prescriptionFileUrl = cleanUrl;
          
          logger.info(`   ✅ Clean URL: ${cleanUrl}`);
        } catch (e) {
          response.prescriptionFileUrl = booking.prescription.prescriptionFile;
          logger.warn(`   ⚠️  URL parsing failed: ${e.message}`);
        }
      } else {
        logger.warn('   ⚠️  prescriptionFile is NULL');
      }
      
      response.hasPrescription = true;
      response.prescriptionId = booking.prescription._id;
      
      logger.info('   Added to response:');
      logger.info(`      - hasPrescription: true`);
      logger.info(`      - prescriptionFileUrl: ${response.prescriptionFileUrl || 'NULL'}`);
      logger.info(`      - prescriptionId: ${response.prescriptionId}`);
    } else {
      logger.warn('❌ NO PRESCRIPTION for this booking');
      response.hasPrescription = false;
      response.prescriptionFileUrl = null;
      response.prescriptionId = null;
      
      logger.info('   Added to response:');
      logger.info(`      - hasPrescription: false`);
      logger.info(`      - prescriptionFileUrl: null`);
      logger.info(`      - prescriptionId: null`);
    }

    logger.info('════════════════════════════════════════════════════════');
    logger.info('✅ SENDING CALL STATUS RESPONSE');
    logger.info('════════════════════════════════════════════════════════\n');

    res.json(successResponse('Call status fetched', response));
  } catch (error) {
    logger.error('════════════════════════════════════════════════════════');
    logger.error('❌ VIDEO API ERROR');
    logger.error('════════════════════════════════════════════════════════');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    logger.error('════════════════════════════════════════════════════════\n');
    
    res.status(500).json(errorResponse(error.message || 'Failed to get call status'));
  }
};

export {
  createVideoRoom,
  getVideoToken,
  endVideoCall,
  getRoomStatus,
  getServiceStatus,
  handleRoomStatusWebhook,
  startVideoConsultation,
  completeVideoConsultation,
  getCallStatus,
};
