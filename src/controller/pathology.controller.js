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

    const booking = await Booking.findById(id)
      .populate('patient', 'firstName lastName phone email age gender address')
      .populate('provider', 'labName testsOffered firstName lastName');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.provider._id.toString() !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    // Format patient data for easier access
    const formattedBooking = booking.toObject();
    if (formattedBooking.patient) {
      formattedBooking.patient.fullName = `${formattedBooking.patient.firstName || ''} ${formattedBooking.patient.lastName || ''}`.trim();
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
    const { id } = req.params;
    const pathologyId = req.user.userId;

    const file = req.file;
    if (!file) {
      return res.status(400).json(errorResponse('Report file required'));
    }

    const booking = await Booking.findById(id).populate('patient', 'firstName lastName phone email');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.provider.toString() !== pathologyId) {
      return res.status(403).json(errorResponse('Not authorized'));
    }

    booking.report = `/uploads/report/${file.filename}`;
    booking.status = 'completed';
    booking.reportUploadedAt = new Date();
    await booking.save();

    await Pathology.findByIdAndUpdate(pathologyId, {
      $inc: { totalTests: 1 },
    });

    // Send notification
    await notificationService.sendReportReady(
      booking.patient._id.toString(),
      pathologyId
    );

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
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    res.json(successResponse('Report uploaded successfully', booking));
  } catch (error) {
    console.error('Upload report error:', error);
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

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
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
  scheduleSampleCollection,
  uploadReport,
  getDashboard,
  updateBookingStatus,
};