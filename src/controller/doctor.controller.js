import { Doctor } from '../models/Doctor.model.js';
import { bookingService } from '../services/booking.service.js';
import { Prescription } from '../models/Prescription.model.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';


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
      new: true,
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
      { new: true }
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

    const booking = await bookingService.getBooking(id);

    // Verify this appointment belongs to the doctor
    if (booking.provider?.toString() !== doctorId && booking.provider?._id?.toString() !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to view this appointment'));
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

    const booking = await bookingService.acceptBooking(id, doctorId);

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

    // Verify booking exists and belongs to this doctor
    const booking = await bookingService.getBooking(req.body.booking);
    if (booking.provider?.toString() !== doctorId && booking.provider?._id?.toString() !== doctorId) {
      return res.status(403).json(errorResponse('Not authorized to create prescription for this booking'));
    }

    const prescriptionData = {
      ...req.body,
      doctor: doctorId,
      patient: booking.patient?._id || booking.patient,
    };

    const prescription = await Prescription.create(prescriptionData);

    res.status(201).json(successResponse('Prescription created', prescription));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to create prescription'));
  }
};

const getDashboard = async (req, res) => {
  try {
    const doctorId = req.user.userId;

    const [activeBookings, doctor] = await Promise.all([
      bookingService.getActiveBookings(doctorId, 'provider'),
      Doctor.findById(doctorId),
    ]);

    const dashboardData = {
      todayAppointments: activeBookings.length,
      totalConsultations: doctor?.totalConsultations || 0,
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
      { new: true }
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
};