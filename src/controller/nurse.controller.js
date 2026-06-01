import { Nurse } from '../models/Nurse.model.js';
import { bookingService } from '../services/booking.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType, BookingStatus } from '../types/index.js';

const updateProfile = async (req, res) => {
  try {
    const nurseId = req.user.userId;
    const updates = req.body;

    const nurse = await Nurse.findByIdAndUpdate(nurseId, updates, { new: true });

    res.json(successResponse('Profile updated successfully', nurse));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

const updateServices = async (req, res) => {
  try {
    const nurseId = req.user.userId;
    const { servicesOffered } = req.body;

    const nurse = await Nurse.findByIdAndUpdate(
      nurseId,
      { servicesOffered },
      { new: true }
    );

    res.json(successResponse('Services updated', nurse));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update services'));
  }
};

const setAvailability = async (req, res) => {
  try {
    const nurseId = req.user.userId;
    const { availability } = req.body;

    const nurse = await Nurse.findByIdAndUpdate(
      nurseId,
      { availability },
      { new: true }
    );

    res.json(successResponse('Availability updated', nurse));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update availability'));
  }
};

const getBookings = async (req, res) => {
  try {
    const nurseId = req.user.userId;
    const { status, page, limit } = req.query;

    const filters = {
      status,
      serviceType: ServiceType.NURSE,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const { bookings, total } = await bookingService.getUserBookings(
      nurseId,
      'provider',
      filters
    );

    res.json(
      paginatedResponse('Bookings fetched', bookings, filters.page, filters.limit, total)
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch bookings'));
  }
};


const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const nurseId = req.user.userId;

    const booking = await bookingService.acceptBooking(id, nurseId);

    res.json(successResponse('Booking accepted', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept booking'));
  }
};


const startVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const nurseId = req.user.userId;

    const booking = await bookingService.updateBookingStatus(
      id,
      nurseId,
      BookingStatus.IN_PROGRESS
    );

    res.json(successResponse('Visit started', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to start visit'));
  }
};


const completeVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const nurseId = req.user.userId;
    const { notes } = req.body;

    const booking = await bookingService.updateBookingStatus(
      id,
      nurseId,
      BookingStatus.COMPLETED
    );

    if (notes) {
      booking.notes = notes;
      await booking.save();
    }

    await Nurse.findByIdAndUpdate(nurseId, {
      $inc: { totalVisits: 1 },
    });

    res.json(successResponse('Visit completed', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to complete visit'));
  }
};


const getDashboard = async (req, res) => {
  try {
    const nurseId = req.user.userId;

    const [activeBookings, nurse] = await Promise.all([
      bookingService.getActiveBookings(nurseId, 'provider'),
      Nurse.findById(nurseId),
    ]);

    const dashboardData = {
      activeVisits: activeBookings.length,
      totalVisits: nurse?.totalVisits || 0,
      rating: nurse?.rating || { average: 0, count: 0 },
      servicesOffered: nurse?.servicesOffered || [],
    };

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};

// ==================== VITALS CAPTURE ====================

const captureVitals = async (req, res) => {
  try {
    const { id } = req.params;
    const nurseId = req.user.userId;
    const vitalsData = req.body;

    const { Booking } = await import('../models/Booking.model.js');
    
    // Verify booking belongs to this nurse
    const booking = await Booking.findOne({
      _id: id,
      provider: nurseId,
    });

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Add vitals to booking
    const vitals = {
      bloodPressure: vitalsData.bloodPressure,
      heartRate: vitalsData.heartRate,
      temperature: vitalsData.temperature,
      oxygenSaturation: vitalsData.oxygenSaturation,
      respiratoryRate: vitalsData.respiratoryRate,
      weight: vitalsData.weight,
      height: vitalsData.height,
      notes: vitalsData.notes,
      capturedAt: new Date(),
      capturedBy: nurseId,
    };

    if (!booking.vitals) {
      booking.vitals = [];
    }
    booking.vitals.push(vitals);
    await booking.save();

    // Emit socket event to patient
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      
      socketHandler.emitToUser(booking.patient.toString(), 'vitals:captured', {
        bookingId: id,
        vitals,
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    res.json(successResponse('Vitals captured successfully', vitals));
  } catch (error) {
    console.error('Capture vitals error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to capture vitals'));
  }
};

const getVitals = async (req, res) => {
  try {
    const { id } = req.params;
    const nurseId = req.user.userId;

    const { Booking } = await import('../models/Booking.model.js');
    
    const booking = await Booking.findOne({
      _id: id,
      provider: nurseId,
    }).select('vitals patient');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    res.json(successResponse('Vitals history fetched', {
      bookingId: id,
      vitals: booking.vitals || [],
    }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch vitals'));
  }
};

const updateLocation = async (req, res) => {
  try {
    const nurseId = req.user.userId;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json(errorResponse('Latitude and longitude are required'));
    }

    const nurse = await Nurse.findByIdAndUpdate(
      nurseId,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
      },
      { new: true }
    );

    res.json(successResponse('Location updated successfully', {
      location: nurse.location,
    }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update location'));
  }
};

export {
  updateProfile,
  updateServices,
  setAvailability,
  getBookings,
  acceptBooking,
  startVisit,
  completeVisit,
  getDashboard,
  captureVitals,
  getVitals,
  updateLocation,
};