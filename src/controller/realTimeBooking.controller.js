import { realTimeBookingService } from "../services/realTimeBooking.service.js";
import { RealTimeBooking } from "../models/RealTimeBooking.model.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";

// Patient creates a real-time booking request
const createBookingRequest = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    // Support both formats: nested requirements object or flat structure
    const requirements = req.body.requirements || {};
    
    const bookingData = {
      patient: patientId,
      serviceType: req.body.serviceType,
      title: req.body.title || req.body.requirements?.description || 'Service Request',
      requirements: {
        description: requirements.description || req.body.description || req.body.title || 'Service Request',
        urgency: requirements.urgency || req.body.urgency || "medium",
        preferredTime: requirements.preferredTime || req.body.preferredTime,
        specialRequirements: requirements.specialRequirements || req.body.specialRequirements,
      },
      location: {
        address: req.body.address || req.body.location?.address || '',
        coordinates: req.body.coordinates || req.body.location?.coordinates || [0, 0],
      },
      isEmergency: req.body.isEmergency || false,
      notes: req.body.notes,
      totalAmount: req.body.totalAmount || 0,
    };

    // Validate required fields
    if (!bookingData.serviceType) {
      return res.status(400).json(errorResponse("Service type is required"));
    }

    // For pharmacist orders, medicines array is REQUIRED
    if (bookingData.serviceType === 'pharmacist') {
      if (!req.body.medicines || !Array.isArray(req.body.medicines) || req.body.medicines.length === 0) {
        return res.status(400).json(errorResponse("Medicines array is required for pharmacist orders. Please add at least one medicine with medicineId and quantity."));
      }
      
      // Validate medicine availability and stock
      const { Medicine } = await import('../models/Medicine.model.js');
      
      const medicineDetails = await Promise.all(
        req.body.medicines.map(async (item) => {
          if (!item.medicineId) {
            throw new Error("Each medicine must have a medicineId");
          }
          
          if (!item.quantity || item.quantity < 1) {
            throw new Error("Each medicine must have a valid quantity (minimum 1)");
          }
          
          const medicine = await Medicine.findById(item.medicineId);
          
          if (!medicine) {
            throw new Error(`Medicine not found: ${item.medicineId}`);
          }
          
          if (!medicine.isActive) {
            throw new Error(`Medicine is not available: ${medicine.name}`);
          }
          
          if (medicine.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${medicine.name}. Available: ${medicine.stock}, Requested: ${item.quantity}`);
          }
          
          return {
            medicineId: medicine._id,
            name: medicine.name,
            quantity: item.quantity,
            price: medicine.discountedPrice || medicine.price,
          };
        })
      );
      
      bookingData.medicines = medicineDetails;
      
      // Calculate total price
      bookingData.price = medicineDetails.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);
    }

    if (!bookingData.requirements.description) {
      return res.status(400).json(errorResponse("Description is required"));
    }

    // Validate location - allow empty coordinates but require address
    if (!bookingData.location.address) {
      return res.status(400).json(errorResponse("Address is required"));
    }
    
    // If coordinates are not provided or are [0,0], set default coordinates
    if (!bookingData.location.coordinates || 
        bookingData.location.coordinates.length !== 2 ||
        (bookingData.location.coordinates[0] === 0 && bookingData.location.coordinates[1] === 0)) {
      // Set default coordinates for Mumbai
      bookingData.location.coordinates = [72.8777, 19.0760];
    }

    const booking = await realTimeBookingService.createRealTimeBooking(bookingData);

    return res.status(201).json(
      successResponse(
        "Booking request created and sent to nearby providers",
        booking
      )
    );
  } catch (error) {
    console.error("Create booking error:", error);
    return res.status(500).json(errorResponse(error.message || "Failed to create booking request"));
  }
};

// Provider accepts a booking request
const acceptBookingRequest = async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { bookingId } = req.params;

    const booking = await realTimeBookingService.acceptBooking(bookingId, providerId);

    res.json(
      successResponse(
        "Booking accepted successfully. Patient has been notified.",
        booking
      )
    );
  } catch (error) {
    const statusCode = error.message.includes("already been accepted") ? 409 : 500;
    res.status(statusCode).json(errorResponse(error.message || "Failed to accept booking"));
  }
};

// Provider updates booking status
const updateStatus = async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json(errorResponse("Status is required"));
    }

    const validStatuses = ["on_the_way", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(errorResponse("Invalid status"));
    }

    const booking = await realTimeBookingService.updateBookingStatus(
      bookingId,
      providerId,
      status
    );

    res.json(successResponse("Booking status updated", booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to update status"));
  }
};

// Patient or Provider cancels booking
const cancelBooking = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookingId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json(errorResponse("Cancellation reason is required"));
    }

    const booking = await realTimeBookingService.cancelBooking(
      bookingId,
      userId,
      reason
    );

    res.json(successResponse("Booking cancelled successfully", booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to cancel booking"));
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookingId } = req.params;

    const booking = await realTimeBookingService.getBookingById(bookingId, userId);

    res.json(successResponse("Booking details fetched", booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch booking"));
  }
};

// Patient gets their bookings
const getMyBookings = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { status, page, limit } = req.query;

    const filters = {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const result = await realTimeBookingService.getPatientBookings(patientId, filters);

    res.json(
      paginatedResponse(
        "Bookings fetched successfully",
        result.bookings,
        result.page,
        filters.limit,
        result.total
      )
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch bookings"));
  }
};

// Patient Dashboard - Overview stats
const getPatientDashboard = async (req, res) => {
  try {
    const patientId = req.user.userId;

    const [
      activeBookings,
      completedBookings,
      totalSpent,
      recentBookings,
    ] = await Promise.all([
      realTimeBookingService.getPatientBookings(patientId, {
        status: { $in: ['pending', 'accepted', 'on_the_way', 'in_progress'] },
      }),
      realTimeBookingService.getPatientBookings(patientId, {
        status: 'completed',
      }),
      RealTimeBooking.aggregate([
        {
          $match: {
            patient: patientId,
            status: 'completed',
            price: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$price' },
          },
        },
      ]),
      realTimeBookingService.getPatientBookings(patientId, {
        page: 1,
        limit: 5,
      }),
    ]);

    res.json(
      successResponse("Patient dashboard fetched", {
        activeBookings: activeBookings.total || 0,
        completedBookings: completedBookings.total || 0,
        totalSpent: totalSpent[0]?.total || 0,
        recentBookings: recentBookings.bookings || [],
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch dashboard"));
  }
};

// Provider gets their booking requests and accepted bookings
const getProviderBookings = async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { status, page, limit } = req.query;

    const filters = {
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const result = await realTimeBookingService.getProviderBookings(providerId, filters);

    res.json(
      paginatedResponse(
        "Bookings fetched successfully",
        result.bookings,
        result.page,
        filters.limit,
        result.total
      )
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch bookings"));
  }
};

// Provider Dashboard - Overview stats
const getProviderDashboard = async (req, res) => {
  try {
    const providerId = req.user.userId;

    const [
      pendingRequests,
      activeBookings,
      completedBookings,
      totalEarnings,
      recentBookings,
    ] = await Promise.all([
      realTimeBookingService.getProviderBookings(providerId, {
        status: 'pending',
      }),
      realTimeBookingService.getProviderBookings(providerId, {
        status: { $in: ['accepted', 'on_the_way', 'in_progress'] },
      }),
      realTimeBookingService.getProviderBookings(providerId, {
        status: 'completed',
      }),
      RealTimeBooking.aggregate([
        {
          $match: {
            acceptedProvider: providerId,
            status: 'completed',
            price: { $exists: true },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$price' },
          },
        },
      ]),
      realTimeBookingService.getProviderBookings(providerId, {
        page: 1,
        limit: 5,
      }),
    ]);

    res.json(
      successResponse("Provider dashboard fetched", {
        pendingRequests: pendingRequests.total || 0,
        activeBookings: activeBookings.total || 0,
        completedBookings: completedBookings.total || 0,
        totalEarnings: totalEarnings[0]?.total || 0,
        recentBookings: recentBookings.bookings || [],
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch dashboard"));
  }
};

// Provider marks booking as viewed
const markAsViewed = async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { bookingId } = req.params;

    await realTimeBookingService.markBookingAsViewed(bookingId, providerId);

    res.json(successResponse("Booking marked as viewed"));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to mark as viewed"));
  }
};

export {
  createBookingRequest,
  acceptBookingRequest,
  updateStatus,
  cancelBooking,
  getBookingDetails,
  getMyBookings,
  getPatientDashboard,
  getProviderBookings,
  getProviderDashboard,
  markAsViewed,
};
