/**
 * Video Call Controller
 * Handles video consultation endpoints (Zoom)
 */

import { zoomService } from '../services/zoom.service.js';
import { Booking } from '../models/Booking.model.js';
import { Doctor } from '../models/Doctor.model.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Create video room for consultation (Zoom)
 */
const createVideoRoom = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user.userId;

    // Verify booking exists and user is part of it
    const booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate({
        path: 'provider',
        select: 'firstName lastName consultationTypes specialization role',
        model: 'User' // Explicitly specify the model
      });

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check if user is patient or provider
    const isPatient = booking.patient._id.toString() === userId;
    const isProvider = booking.provider._id.toString() === userId;

    if (!isPatient && !isProvider) {
      return res.status(403).json(errorResponse('Not authorized to access this consultation'));
    }

    // Check if booking is for video consultation
    // If doctor only supports video-call and booking is in-person, auto-convert it
    if (booking.consultationType !== 'video-call') {
      logger.info(`🔍 Debugging booking ${bookingId}:`);
      logger.info(`  - Consultation type: ${booking.consultationType}`);
      logger.info(`  - Provider ID: ${booking.provider._id}`);
      logger.info(`  - Provider name: ${booking.provider.firstName} ${booking.provider.lastName}`);
      logger.info(`  - Provider consultationTypes: ${JSON.stringify(booking.provider.consultationTypes)}`);
      logger.info(`  - Provider consultationTypes type: ${typeof booking.provider.consultationTypes}`);
      logger.info(`  - Provider consultationTypes length: ${booking.provider.consultationTypes?.length}`);
      logger.info(`  - Full provider object: ${JSON.stringify(booking.provider, null, 2)}`);
      
      // Check if doctor supports video calls
      let doctorSupportsVideo = booking.provider.consultationTypes && 
                               Array.isArray(booking.provider.consultationTypes) &&
                               booking.provider.consultationTypes.includes('video-call');
      
      // If consultationTypes is not populated, fetch doctor directly
      if (!booking.provider.consultationTypes || booking.provider.consultationTypes.length === 0) {
        logger.info(`🔄 consultationTypes not populated, fetching doctor directly...`);
        try {
          const doctor = await Doctor.findById(booking.provider._id);
          if (doctor && doctor.consultationTypes) {
            logger.info(`  - Direct doctor query consultationTypes: ${JSON.stringify(doctor.consultationTypes)}`);
            doctorSupportsVideo = doctor.consultationTypes.includes('video-call');
            // Update the booking provider object with consultationTypes for future use
            booking.provider.consultationTypes = doctor.consultationTypes;
          }
        } catch (directQueryError) {
          logger.error(`❌ Failed to fetch doctor directly: ${directQueryError.message}`);
        }
      }
      
      logger.info(`  - Doctor supports video: ${doctorSupportsVideo}`);
      
      if (doctorSupportsVideo && booking.consultationType === 'in-person') {
        // Auto-convert in-person to video-call if doctor supports video
        logger.info(`🔄 Auto-converting booking ${bookingId} from in-person to video-call`);
        
        try {
          booking.consultationType = 'video-call';
          booking.location = undefined; // Remove location for video calls
          await booking.save();
          logger.info(`✅ Booking ${bookingId} successfully converted to video-call`);
        } catch (saveError) {
          logger.error(`❌ Failed to save booking conversion: ${saveError.message}`);
          return res.status(500).json(errorResponse('Failed to convert booking to video consultation'));
        }
      } else {
        logger.error(`❌ Video room creation failed for booking ${bookingId}:`, {
          consultationType: booking.consultationType,
          doctorSupportsVideo,
          doctorConsultationTypes: booking.provider.consultationTypes,
          doctorId: booking.provider._id
        });
        
        // Provide more specific error message
        if (!doctorSupportsVideo) {
          return res.status(400).json(errorResponse(`Doctor does not support video consultations. Supported types: ${booking.provider.consultationTypes?.join(', ') || 'none'}`));
        } else {
          return res.status(400).json(errorResponse('This booking is not for video consultation'));
        }
      }
    }

    // Check booking status
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      return res.status(400).json(errorResponse('Consultation not ready. Status: ' + booking.status));
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
    const booking = await Booking.findById(bookingId);

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
    const booking = await Booking.findById(bookingId);

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

    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    logger.info(`Video consultation ended for booking: ${bookingId}`);

    res.json(successResponse('Video consultation ended', {
      bookingId,
      status: 'completed',
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
    const booking = await Booking.findById(bookingId);

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
    const booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate('provider', 'firstName lastName role');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Only healthcare providers can start consultations
    const isProvider = booking.provider._id.toString() === userId;
    if (!isProvider) {
      return res.status(403).json(errorResponse('Only healthcare providers can start consultations'));
    }

    // Check if booking is ready for consultation
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      return res.status(400).json(errorResponse(`Cannot start consultation. Current status: ${booking.status}`));
    }

    // Update booking status to in_progress and set start time
    const now = new Date();
    booking.status = 'in_progress';
    booking.startTime = now;
    booking.meetingStartTime = now;

    // If no end time is set, calculate it based on duration or default to 30 minutes
    if (!booking.endTime) {
      const durationMinutes = booking.duration || 30;
      booking.endTime = new Date(now.getTime() + (durationMinutes * 60 * 1000));
    }

    await booking.save();

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
    const booking = await Booking.findById(bookingId)
      .populate('patient', 'firstName lastName')
      .populate('provider', 'firstName lastName role');

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

    // Calculate actual duration
    if (booking.startTime) {
      booking.duration = Math.round((now - booking.startTime) / (1000 * 60)); // minutes
    }

    await booking.save();

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

export {
  createVideoRoom,
  getVideoToken,
  endVideoCall,
  getRoomStatus,
  getServiceStatus,
  handleRoomStatusWebhook,
  startVideoConsultation,
  completeVideoConsultation,
};
