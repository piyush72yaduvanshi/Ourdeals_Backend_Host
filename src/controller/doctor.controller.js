import { Doctor } from '../models/Doctor.model.js';
import { Booking } from '../models/Booking.model.js';
import { bookingService } from '../services/booking.service.js';
import { Prescription } from '../models/Prescription.model.js';
import { s3Service } from '../services/s3.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';
import { parseAsIST } from '../utils/timezone.util.js';
import { notificationService } from '../services/notification.service.js';
import redisClient from '../config/redis.js';


const DOCTOR_ALLOWED_FIELDS = [
  'firstName', 'lastName', 'phone', 'address', 'city', 'state', 'pincode',
  'specialization', 'qualifications', 'experience', 'consultationFee',
  'languages', 'about', 'profilePicture',
];

const updateProfile = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const updates = {};
    DOCTOR_ALLOWED_FIELDS.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const doctor = await Doctor.findByIdAndUpdate(doctorId, updates, {
      returnDocument: 'after',
    });

    res.json(successResponse('Profile updated successfully', doctor));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

const setAvailability = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { availability } = req.body;

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { availability },
      { returnDocument: 'after' }
    );

    res.json(successResponse('Availability updated', doctor));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update availability'));
  }
};

const getAppointments = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { status, page, limit } = req.query;

    const filters = {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const { bookings, total } = await bookingService.getUserBookings(
      doctorId,
      'provider',
      filters
    );

    // If fetching requested appointments, also fetch RealTimeBooking requests
    if (status === 'requested' || !status || status === 'all') {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      const realTimeQuery = {
        $or: [
          { acceptedProvider: doctorId },
          { 
            "notifiedProviders.provider": doctorId, 
            status: "requested",
            acceptedProvider: null, // Only show if no one has accepted yet
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } }
            ]
          },
        ],
        // Exclude cancelled and expired bookings
        status: { $nin: ["cancelled", "expired"] },
      };
      
      if (status === 'requested') {
        realTimeQuery.status = 'requested';
      }

      const realTimeBookings = await RealTimeBooking.find(realTimeQuery)
        .populate("patient", "firstName lastName phone")
        .sort({ createdAt: -1 })
        .lean();

      // Normalize RealTimeBooking to look like standard Booking for frontend
      const normalizedRealTime = realTimeBookings.map(rtb => ({
        _id: rtb._id,
        patient: rtb.patient,
        serviceType: rtb.serviceType,
        status: rtb.status,
        scheduledTime: rtb.requirements?.preferredTime || rtb.createdAt,
        price: rtb.price || rtb.totalAmount || 0,
        notes: rtb.notes || '',
        consultationType: 'video-call',
        isEmergency: rtb.isEmergency || false,
        location: rtb.location,
        createdAt: rtb.createdAt,
        isRealTime: true,
      }));

      // Combine and sort
      const combinedBookings = [...bookings, ...normalizedRealTime].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Simple memory pagination for the combined results
      const startIndex = (filters.page - 1) * filters.limit;
      const paginatedCombined = combinedBookings.slice(startIndex, startIndex + filters.limit);

      return res.json(
        paginatedResponse(
          'Appointments fetched',
          paginatedCombined,
          filters.page,
          filters.limit,
          combinedBookings.length
        )
      );
    }

    res.json(
      paginatedResponse(
        'Appointments fetched',
        bookings,
        filters.page,
        filters.limit,
        total
      )
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch appointments'));
  }
};

const getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.userId;

    let booking;
    let isRealTime = false;
    try {
      booking = await bookingService.getBooking(id);
      if (booking.notifiedProviders) {
        isRealTime = true;
      }
    } catch (err) {
      if (err.message === 'Booking not found') {
        const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');
        booking = await realTimeBookingService.getBookingById(id, doctorId);
        isRealTime = true;
      } else {
        throw err;
      }
    }

    // Verify this appointment belongs to the doctor
    if (!isRealTime) {
      if (booking.provider?.toString() !== doctorId && booking.provider?._id?.toString() !== doctorId) {
        return res.status(403).json(errorResponse('Not authorized to view this appointment'));
      }
    } else {
      const isAccepted = booking.acceptedProvider?.toString() === doctorId || booking.acceptedProvider?._id?.toString() === doctorId;
      const isNotified = booking.notifiedProviders?.some(
        np => np.provider?.toString() === doctorId || np.provider?._id?.toString() === doctorId
      );
      
      if (!isAccepted && !isNotified) {
        return res.status(403).json(errorResponse('Not authorized to view this appointment'));
      }
    }

    res.json(successResponse('Appointment details fetched', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to fetch appointment details'));
  }
};

const acceptAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.userId;

    let booking;
    try {
      booking = await bookingService.acceptBooking(id, doctorId);
    } catch (err) {
      if (err.message === 'Booking not found') {
        const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');
        booking = await realTimeBookingService.acceptBooking(id, doctorId);
      } else {
        throw err;
      }
    }

    res.json(
      successResponse('Appointment accepted', {
        booking,
      })
    );
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept appointment'));
  }
};

const createPrescription = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { bookingId, booking, ...prescriptionData } = req.body;

    // Support both 'bookingId' and 'booking' field names
    const actualBookingId = bookingId || booking;

    if (!actualBookingId) {
      return res.status(400).json(errorResponse('bookingId is required'));
    }

    // Verify booking exists and belongs to this doctor
    const bookingRecord = await bookingService.getBooking(actualBookingId);
    if (!bookingRecord) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (bookingRecord.provider?.toString() !== doctorId && bookingRecord.provider?._id?.toString() !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to create prescription for this booking'));
    }

    // Check if prescription already exists
    const existingPrescription = await Prescription.findOne({ booking: actualBookingId });
    if (existingPrescription) {
      return res.status(400).json(errorResponse('Prescription already exists for this booking'));
    }

    // Update booking status to in_progress if it's still accepted
    if (bookingRecord.status === 'accepted') {
      await Booking.findByIdAndUpdate(actualBookingId, {
        status: 'in_progress',
      });
    }

    const finalPrescriptionData = {
      ...prescriptionData,
      booking: actualBookingId,
      doctor: doctorId,
      patient: bookingRecord.patient?._id || bookingRecord.patient,
    };

    const prescription = await Prescription.create(finalPrescriptionData);

    // Update booking with prescription reference
    await Booking.findByIdAndUpdate(actualBookingId, {
      prescription: prescription._id,
    });

    // Return the prescription with populated data
    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate('doctor', 'firstName lastName specialization')
      .populate('patient', 'firstName lastName')
      .lean();

    res.status(201).json(successResponse('Prescription created successfully', populatedPrescription));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to create prescription'));
  }
};

const uploadPrescriptionFile = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const bookingId = req.params.id;
    const notes = req.body?.notes?.toString().trim() || '';

    console.log('📋 Upload Prescription - Start', {
      doctorId,
      bookingId,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
    });

    if (!req.file) {
      return res.status(400).json(errorResponse('Prescription file is required'));
    }

    // Get booking
    console.log('📋 Fetching booking...');
    const bookingRecord = await bookingService.getBooking(bookingId);
    if (!bookingRecord) {
      console.log('❌ Booking not found');
      return res.status(404).json(errorResponse('Booking not found'));
    }

    console.log('✅ Booking found:', bookingRecord.status);

    // Handle both Booking (provider) and RealTimeBooking (acceptedProvider) models
    // Extract provider ID - handle both string and ObjectId cases
    let providerId = null;
    
    if (bookingRecord.provider) {
      // If provider exists, convert to string
      if (typeof bookingRecord.provider === 'string') {
        providerId = bookingRecord.provider;
      } else if (bookingRecord.provider._id) {
        providerId = bookingRecord.provider._id.toString();
      } else {
        providerId = bookingRecord.provider.toString();
      }
    } else if (bookingRecord.acceptedProvider) {
      // Check acceptedProvider for RealTimeBooking
      if (typeof bookingRecord.acceptedProvider === 'string') {
        providerId = bookingRecord.acceptedProvider;
      } else if (bookingRecord.acceptedProvider._id) {
        providerId = bookingRecord.acceptedProvider._id.toString();
      } else {
        providerId = bookingRecord.acceptedProvider.toString();
      }
    }
    
    console.log('🔐 Authorization Check:', {
      doctorId,
      providerId,
      providerType: typeof bookingRecord.provider,
      match: providerId === doctorId
    });

    if (!providerId || providerId !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to upload prescription for this booking'));
    }

    if (!['in_progress', 'completed', 'accepted'].includes(bookingRecord.status)) {
      return res.status(400).json(
        errorResponse(`Booking must be accepted or in progress. Current status: ${bookingRecord.status}`)
      );
    }

    // Upload file to S3
    console.log('📤 Uploading file to S3...');
    const uploadResult = await s3Service.uploadFile(req.file, 'prescriptions', doctorId);
    console.log('✅ File uploaded:', uploadResult);
    
    const prescriptionFileUrl = s3Service.cleanS3Url(uploadResult.fileUrl);
    console.log('🔗 Clean URL:', prescriptionFileUrl);

    // Create or update prescription
    console.log('💊 Creating/Updating prescription...');
    let prescription = await Prescription.findOne({ booking: bookingId });
    if (prescription) {
      console.log('✏️ Updating existing prescription');
      prescription.prescriptionFile = prescriptionFileUrl;
      if (notes) {
        prescription.notes = notes;
        prescription.advice = notes;
      }
      await prescription.save();
    } else {
      console.log('➕ Creating new prescription');
      prescription = await Prescription.create({
        booking: bookingId,
        patient: bookingRecord.patient?._id || bookingRecord.patient,
        doctor: doctorId,
        diagnosis: notes || 'Consultation prescription',
        medicines: [],
        advice: notes || undefined,
        prescriptionFile: prescriptionFileUrl,
        notes: notes || undefined,
      });

      // Update booking with prescription reference IMMEDIATELY
      console.log('🔄 Updating booking with prescription reference...');
      try {
        await Booking.findByIdAndUpdate(bookingId, {
          prescription: prescription._id,
          status: bookingRecord.status === 'accepted' ? 'in_progress' : bookingRecord.status,
        });
        console.log('✅ Booking model updated');
      } catch (err) {
        console.log('⚠️ Booking not found, trying RealTimeBooking...');
        const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
        await RealTimeBooking.findByIdAndUpdate(bookingId, {
          prescription: prescription._id,
          status: bookingRecord.status === 'accepted' ? 'in_progress' : bookingRecord.status,
        });
        console.log('✅ RealTimeBooking model updated');
      }
    }

    // CRITICAL: Also update prescription reference for existing prescriptions
    if (prescription && !bookingRecord.prescription) {
      console.log('🔄 Updating booking with prescription reference (existing prescription)...');
      try {
        await Booking.findByIdAndUpdate(bookingId, {
          prescription: prescription._id,
        });
      } catch (err) {
        const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
        await RealTimeBooking.findByIdAndUpdate(bookingId, {
          prescription: prescription._id,
        });
      }
      console.log('✅ Booking reference updated');
    }

    // CRITICAL: Invalidate Redis cache for INSTANT real-time updates
    console.log('🗑️  Invalidating Redis cache for instant updates...');
    try {
      // Check if Redis is available and ready
      if (redisClient && typeof redisClient.isReady !== 'undefined' && redisClient.isReady) {
        // Clear booking cache so next API call gets fresh data
        const cacheKeys = [
          `booking:${bookingId}`,
          `booking:details:${bookingId}`,
          `user:bookings:${patientId}`,
          `call:status:${bookingId}`,
        ];
        
        for (const key of cacheKeys) {
          await redisClient.del(key);
          console.log(`   ✅ Cleared cache key: ${key}`);
        }
        
        console.log('✅ Redis cache invalidated successfully');
      } else {
        console.log('⚠️  Redis not available, skipping cache invalidation (app will work normally)');
      }
    } catch (cacheError) {
      console.error('⚠️  Failed to invalidate cache:', cacheError.message);
      console.log('   ℹ️  Continuing without cache invalidation - functionality not affected');
      // Don't fail upload if cache clear fails - app works fine without Redis
    }

    console.log('✅ Prescription uploaded successfully!');
    
    logger.info('Prescription file uploaded', {
      bookingId,
      doctorId,
      prescriptionId: prescription._id,
    });

    // Send notification to patient that prescription is ready
    const patientId = bookingRecord.patient?._id || bookingRecord.patient;
    if (patientId) {
      try {
        await notificationService.sendNotification(
          patientId,
          'PRESCRIPTION_READY',
          'Prescription Ready',
          'Your prescription is ready to download. Please check your booking details.',
          {
            bookingId: bookingId,
            prescriptionId: prescription._id.toString(),
            type: 'prescription',
            action: 'view_booking',
          }
        );
        console.log('📲 Notification sent to patient');
      } catch (notifError) {
        console.error('⚠️ Failed to send notification:', notifError.message);
        // Don't fail the upload if notification fails
      }

      // Send real-time Socket.IO event for INSTANT update
      try {
        const { getSocketHandler } = await import('../socket/socket.handler.js');
        const socketHandler = getSocketHandler();
        
        // Prepare complete prescription data for instant UI update
        const prescriptionData = {
          bookingId: bookingId,
          prescriptionId: prescription._id.toString(),
          prescriptionFileUrl: prescriptionFileUrl,
          hasPrescription: true,
          prescription: {
            _id: prescription._id.toString(),
            prescriptionFile: prescriptionFileUrl,
            diagnosis: prescription.diagnosis,
            medicines: prescription.medicines || [],
            advice: prescription.advice,
            notes: prescription.notes,
            createdAt: prescription.createdAt,
          },
          uploadedAt: new Date().toISOString(),
          message: 'Your prescription is ready to download',
        };
        
        // Emit to patient IMMEDIATELY for real-time update
        socketHandler.emitToUser(patientId.toString(), 'prescription:uploaded', prescriptionData);
        
        // Also emit generic event for call-status listeners
        socketHandler.emitToUser(patientId.toString(), 'booking:updated', {
          bookingId: bookingId,
          type: 'prescription_uploaded',
          data: prescriptionData,
        });
        
        console.log('🔔 Real-time socket events sent to patient:', patientId.toString());
        console.log('   Event 1: prescription:uploaded');
        console.log('   Event 2: booking:updated');
      } catch (socketError) {
        console.error('⚠️ Failed to send socket event:', socketError.message);
        // Don't fail the upload if socket fails
      }
    }

    res.status(201).json(successResponse('Prescription uploaded successfully', {
      prescriptionId: prescription._id,
      prescriptionFile: prescriptionFileUrl,
    }));

  } catch (error) {
    console.error('❌ Upload Prescription Error:', {
      message: error.message,
      stack: error.stack,
      bookingId: req.params.id,
      doctorId: req.user?.userId,
    });

    logger.error('Failed to upload prescription', {
      error: error.message,
      stack: error.stack,
      bookingId: req.params.id,
    });

    res.status(500).json(errorResponse('Failed to upload prescription', error.message));
  }
};

const getDashboard = async (req, res) => {
  try {
    const doctorId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');

    const [activeBookings, doctor, realTimeRequested, realTimeAccepted, realTimeCompleted] = await Promise.all([
      bookingService.getActiveBookings(doctorId, 'provider'),
      Doctor.findById(doctorId),
      // Count active real-time requests (not expired, not accepted by anyone)
      RealTimeBooking.countDocuments({
        'notifiedProviders.provider': doctorId,
        status: 'requested',
        acceptedProvider: null,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      }),
      // Count accepted real-time bookings
      RealTimeBooking.countDocuments({
        acceptedProvider: doctorId,
        status: 'accepted',
      }),
      // Count completed real-time bookings
      RealTimeBooking.countDocuments({
        acceptedProvider: doctorId,
        status: 'completed',
      }),
    ]);

    const dashboardData = {
      todayAppointments: activeBookings.length + realTimeRequested,
      totalConsultations: (doctor?.totalConsultations || 0) + realTimeCompleted,
      acceptedAppointments: activeBookings.filter(b => b.status === 'accepted').length + realTimeAccepted,
      rating: doctor?.rating || { average: 0, count: 0 },
      upcomingAppointments: activeBookings,
    };

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};

const updateLocation = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json(errorResponse('Latitude and longitude are required'));
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
      { returnDocument: 'after' }
    );

    res.json(successResponse('Location updated successfully', {
      location: doctor.location,
    }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update location'));
  }
};

const completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.userId;

    const booking = await bookingService.completeBooking(id, doctorId);

    res.json(successResponse('Appointment completed successfully', {
      bookingId: booking._id,
      status: booking.status,
    }));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to complete appointment'));
  }
};

const markVideoCallCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.userId;

    // Verify booking exists and belongs to this doctor
    const booking = await bookingService.getBooking(id);
    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.provider?.toString() !== doctorId && booking.provider?._id?.toString() !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to update this booking'));
    }

    // Update booking to mark video call as completed
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { videoCallCompleted: true },
      { returnDocument: 'after' }
    );

    res.json(successResponse('Video call marked as completed', {
      bookingId: updatedBooking._id,
      videoCallCompleted: updatedBooking.videoCallCompleted,
    }));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to mark video call as completed'));
  }
};

const scheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, scheduledTime } = req.body;
    const doctorId = req.user.userId;

    let booking;
    try {
      booking = await bookingService.getBooking(id);
    } catch (err) {
      if (err.message === 'Booking not found') {
        const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');
        booking = await realTimeBookingService.getBookingById(id, doctorId);
      } else {
        throw err;
      }
    }

    if (booking.provider?.toString() !== doctorId && booking.provider?._id?.toString() !== doctorId &&
        booking.acceptedProvider?.toString() !== doctorId && booking.acceptedProvider?._id?.toString() !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to schedule this appointment'));
    }

    // Parse and convert IST time to proper format
    let timeToSave = scheduledTime;
    if (scheduledDate && scheduledTime) {
      // Combine date and time
      const [time, period] = scheduledTime.split(' ');
      let [hours, minutes] = time.split(':');
      hours = parseInt(hours);
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const dateObj = new Date(scheduledDate);
      dateObj.setHours(hours, parseInt(minutes), 0, 0);
      
      // Parse as IST to save correctly
      timeToSave = parseAsIST(dateObj.toISOString());
    } else if (scheduledTime) {
      // Only time provided, parse as IST
      timeToSave = parseAsIST(scheduledTime);
    }

    let updatedBooking;
    const BookingModel = await import('../models/Booking.model.js').then(m => m.Booking);
    
    // First try standard booking
    updatedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { scheduledTime: timeToSave },
      { returnDocument: 'after' }
    );

    if (!updatedBooking) {
      // Try RealTimeBooking
      const RealTimeBookingModel = await import('../models/RealTimeBooking.model.js').then(m => m.RealTimeBooking);
      updatedBooking = await RealTimeBookingModel.findByIdAndUpdate(
        id,
        { 'requirements.preferredTime': timeToSave, scheduledTime: timeToSave },
        { returnDocument: 'after' }
      );
    }

    res.json(successResponse('Appointment scheduled successfully', updatedBooking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to schedule appointment'));
  }
};

export {
  updateProfile,
  setAvailability,
  getAppointments,
  getAppointmentDetails,
  acceptAppointment,
  createPrescription,
  getDashboard,
  updateLocation,
  completeAppointment,
  markVideoCallCompleted,
  scheduleAppointment,
  uploadPrescriptionFile,
};