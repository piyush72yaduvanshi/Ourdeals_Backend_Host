import { Pathology } from '../models/Pathology.model.js';
import { Booking } from '../models/Booking.model.js';
import { bookingService } from '../services/booking.service.js';
import { notificationService } from '../services/notification.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType } from '../types/index.js';

const updateProfile = async (req, res) => {
  try {
    const pathologyId = req.user.userId;
    const updates = req.body;

    const pathology = await Pathology.findByIdAndUpdate(pathologyId, updates, {
      new: true,
    });

    res.json(successResponse('Profile updated successfully', pathology));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

const updateTests = async (req, res) => {
  try {
    const pathologyId = req.user.userId;
    const { testsOffered } = req.body;

    const pathology = await Pathology.findByIdAndUpdate(
      pathologyId,
      { testsOffered },
      { new: true }
    );

    res.json(successResponse('Tests updated', pathology?.testsOffered));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update tests'));
  }
};


const getBookings = async (req, res) => {
  try {
    const pathologyId = req.user.userId;
    const { status, page, limit } = req.query;

    const filters = {
      status,
      serviceType: ServiceType.PATHOLOGY,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const { bookings, total } = await bookingService.getUserBookings(
      pathologyId,
      'provider',
      filters
    );

    res.json(
      paginatedResponse('Test bookings fetched', bookings, filters.page, filters.limit, total)
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch bookings'));
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.userId;

    let booking = await Booking.findById(id)
      .populate('patient', 'firstName lastName phone email age gender address')
      .populate('provider', 'labName testsOffered firstName lastName');
    
    let isRealTime = false;
    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(id)
        .populate('patient', 'firstName lastName phone email age gender address')
        .populate('acceptedProvider', 'labName testsOffered firstName lastName');
      if (booking) isRealTime = true;
    }

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    const providerIdToCompare = isRealTime 
      ? (booking.acceptedProvider?._id || booking.acceptedProvider)?.toString() 
      : (booking.provider?._id || booking.provider)?.toString();

    if (providerIdToCompare !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    // Format patient data for easier access
    const formattedBooking = booking.toObject();
    if (formattedBooking.patient) {
      formattedBooking.patient.fullName = `${formattedBooking.patient.firstName || ''} ${formattedBooking.patient.lastName || ''}`.trim();
    }
    if (isRealTime && formattedBooking.acceptedProvider) {
      formattedBooking.provider = formattedBooking.acceptedProvider;
    }

    res.json(successResponse('Booking details fetched', formattedBooking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch booking details'));
  }
};


const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.userId;

    const booking = await bookingService.acceptBooking(id, pathologyId);

    res.json(successResponse('Booking accepted', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept booking'));
  }
};

const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.userId;
    const { reason } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.provider && booking.provider.toString() !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    booking.status = 'rejected';
    if (reason) {
      booking.notes = reason;
    }
    
    await booking.save();

    res.json(successResponse('Booking rejected successfully', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to reject booking'));
  }
};

const scheduleSampleCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.userId;
    const { collectionTime, notes } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.provider.toString() !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    // Check if booking is in correct status for scheduling
    if (booking.status !== 'accepted') {
      return res.status(400).json(errorResponse('Booking must be accepted before scheduling collection'));
    }

    // Check if collection is already scheduled (prevent multiple scheduling)
    if (booking.collectionScheduled) {
      return res.status(400).json(errorResponse('Sample collection is already scheduled. Contact patient to reschedule.'));
    }

    // Validate collection time is in the future
    const collectionDateTime = new Date(collectionTime);
    if (collectionDateTime <= new Date()) {
      return res.status(400).json(errorResponse('Collection time must be in the future'));
    }

    // Update booking with collection details
    booking.scheduledTime = collectionDateTime;
    booking.collectionScheduled = true;
    booking.collectionScheduledAt = new Date();
    if (notes) {
      booking.collectionNotes = notes;
    }
    await booking.save();

    // Send notification to patient about scheduled collection
    await notificationService.sendCollectionScheduled(
      booking.patient.toString(),
      pathologyId,
      collectionDateTime
    );

    res.json(successResponse('Sample collection scheduled successfully', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to schedule collection'));
  }
};

const uploadReport = async (req, res) => {
  try {
    console.log('📤 Upload Report Request:');
    console.log('- Booking ID:', req.params.id);
    console.log('- Pathology ID:', req.user.userId);
    console.log('- File received:', req.file ? 'YES' : 'NO');
    if (req.file) {
      console.log('- File details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename,
        path: req.file.path
      });
    }

    const { id } = req.params;
    const pathologyId = req.user.userId;

    const file = req.file;
    if (!file) {
      console.error('❌ No file received in request');
      return res.status(400).json(errorResponse('Report file required'));
    }

    let booking = await Booking.findById(id).populate('patient', 'firstName lastName phone email');
    let isRealTime = false;

    if (!booking) {
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      booking = await RealTimeBooking.findById(id).populate('patient', 'firstName lastName phone email');
      if (booking) {
        isRealTime = true;
      } else {
        console.error('❌ Booking not found:', id);
        return res.status(404).json(errorResponse('Booking not found'));
      }
    }

    const providerIdToCompare = isRealTime ? booking.acceptedProvider?.toString() : booking.provider?.toString();
    if (providerIdToCompare !== pathologyId) {
      console.error('❌ Not authorized. Provider:', providerIdToCompare, 'User:', pathologyId);
      return res.status(403).json(errorResponse('Not authorized'));
    }

    console.log('✅ Booking found, current status:', booking.status);

    booking.report = `/uploads/report/${file.filename}`;
    booking.status = 'completed';
    if (!isRealTime) {
      booking.reportUploadedAt = new Date();
    } else {
      booking.endTime = new Date();
    }
    await booking.save();

    console.log('✅ Report saved to booking:', booking.report);

    await Pathology.findByIdAndUpdate(pathologyId, {
      $inc: { totalTests: 1 },
    });

    console.log('✅ Pathology stats updated');

    // Send notification
    try {
      await notificationService.sendReportReady(
        booking.patient._id.toString(),
        pathologyId
      );
      console.log('✅ Notification sent to patient');
    } catch (notifError) {
      console.error('⚠️ Notification error:', notifError.message);
    }

    // Emit socket event to patient
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      
      socketHandler.emitToUser(booking.patient._id.toString(), 'report:ready', {
        bookingId: id,
        reportUrl: booking.report,
        timestamp: new Date(),
      });

      socketHandler.emitToBooking(id, 'report:ready', {
        bookingId: id,
        reportUrl: booking.report,
        timestamp: new Date(),
      });
      console.log('✅ Socket events emitted');
    } catch (socketError) {
      console.error('⚠️ Socket emit error:', socketError.message);
    }

    console.log('✅ Report upload completed successfully');
    res.json(successResponse('Report uploaded successfully', booking));
  } catch (error) {
    console.error('❌ Upload report error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to upload report'));
  }
};

const getDashboard = async (req, res) => {
  try {
    const pathologyId = req.user.userId;

    const [activeBookings, pathology] = await Promise.all([
      bookingService.getActiveBookings(pathologyId, 'provider'),
      Pathology.findById(pathologyId),
    ]);

    const dashboardData = {
      activeTests: activeBookings.length,
      totalTests: pathology?.totalTests || 0,
      testsOffered: pathology?.testsOffered?.length || 0,
      homeCollectionAvailable: pathology?.homeCollectionAvailable || false,
    };

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.userId;
    const { status, notes } = req.body;

    let booking = await Booking.findById(id);

    if (!booking) {
      try {
        const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');
        const updatedBooking = await realTimeBookingService.updateBookingStatus(id, pathologyId, status);
        return res.json(successResponse('Booking status updated', updatedBooking));
      } catch (rtError) {
        return res.status(404).json(errorResponse(rtError.message || 'Booking not found'));
      }
    }

    if (booking.provider.toString() !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    booking.status = status;
    if (notes) {
      booking.notes = notes;
    }
    await booking.save();

    res.json(successResponse('Booking status updated', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update booking status'));
  }
};

export {
  updateProfile,
  updateTests,
  getBookings,
  getBookingDetails,
  acceptBooking,
  rejectBooking,
  scheduleSampleCollection,
  uploadReport,
  getDashboard,
  updateBookingStatus,
};