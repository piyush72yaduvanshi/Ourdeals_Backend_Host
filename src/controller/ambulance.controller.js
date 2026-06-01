import { bookingService } from '../services/booking.service.js';
import { locationService } from '../services/location.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType, BookingStatus } from '../types/index.js';

const updateProfile = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;
    const updates = req.body;

    const { User } = await import('../models/User.model.js');
    const ambulance = await User.findByIdAndUpdate(ambulanceId, updates, {
      new: true,
    }).select('-password');

    res.json(successResponse('Profile updated successfully', ambulance));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

const updateLocation = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;
    const { latitude, longitude } = req.body;

    const { User } = await import('../models/User.model.js');
    const ambulance = await User.findByIdAndUpdate(
      ambulanceId,
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
          lastUpdated: new Date(),
        },
      },
      { new: true }
    ).select('-password');

    await locationService.updateUserLocation(ambulanceId, latitude, longitude);

    res.json(successResponse('Location updated', ambulance?.currentLocation));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update location'));
  }
};

const setAvailability = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;
    const { isAvailable } = req.body;

    const { User } = await import('../models/User.model.js');
    const ambulance = await User.findByIdAndUpdate(
      ambulanceId,
      { isAvailable },
      { new: true }
    ).select('-password');

    res.json(successResponse('Availability updated', {
      isAvailable: ambulance?.isAvailable
    }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update availability'));
  }
};

const getRideRequests = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    console.log('=== GET RIDE REQUESTS ===');
    console.log('Ambulance ID:', ambulanceId);
    console.log('Status filter:', status);
    console.log('Page:', page, 'Limit:', limit);

    const { Booking } = await import('../models/Booking.model.js');
    
    // Build query
    const query = {
      provider: ambulanceId,
      serviceType: ServiceType.AMBULANCE,
    };

    // Add status filter if provided and not 'all'
    if (status && status !== 'all') {
      query.status = status;
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('patient', 'firstName lastName phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query),
    ]);

    console.log(`Found ${bookings.length} bookings (total: ${total})`);

    res.json(
      paginatedResponse('Ride requests fetched', bookings, parseInt(page), parseInt(limit), total)
    );
  } catch (error) {
    console.error('Get ride requests error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch requests'));
  }
};

const acceptRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    console.log('=== ACCEPT RIDE ===');
    console.log('Booking ID:', id);
    console.log('Ambulance ID:', ambulanceId);

    const { Booking } = await import('../models/Booking.model.js');
    
    // Find the booking first
    const booking = await Booking.findById(id);
    
    if (!booking) {
      console.log('ERROR: Booking not found');
      return res.status(404).json(errorResponse('Booking not found'));
    }

    console.log('Booking found:', {
      id: booking._id,
      status: booking.status,
      provider: booking.provider,
      serviceType: booking.serviceType,
    });

    // Check if booking is assigned to this ambulance
    if (booking.provider.toString() !== ambulanceId) {
      console.log('ERROR: Booking not assigned to this ambulance');
      return res.status(403).json(errorResponse('This booking is not assigned to you'));
    }

    // Check if booking is in correct status
    if (booking.status !== 'requested') {
      console.log('ERROR: Booking already processed. Current status:', booking.status);
      return res.status(400).json(errorResponse(`Booking is already ${booking.status}`));
    }

    // Update booking status to accepted
    booking.status = 'accepted';
    booking.acceptedAt = new Date();
    await booking.save();

    console.log('Booking accepted successfully');

    // Populate patient details for response
    await booking.populate('patient', 'firstName lastName phone email');

    res.json(successResponse('Ride accepted', booking));
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept ride'));
  }
};

const startRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const booking = await bookingService.updateBookingStatus(
      id,
      ambulanceId,
      BookingStatus.ON_THE_WAY
    );

    res.json(successResponse('Ride started', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to start ride'));
  }
};

const arriveAtPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const booking = await bookingService.updateBookingStatus(
      id,
      ambulanceId,
      BookingStatus.IN_PROGRESS
    );

    res.json(successResponse('Arrived at pickup', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to update status'));
  }
};


const completeRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const booking = await bookingService.updateBookingStatus(
      id,
      ambulanceId,
      BookingStatus.COMPLETED
    );

    const { User } = await import('../models/User.model.js');
    await User.findByIdAndUpdate(ambulanceId, {
      $inc: { totalRides: 1 },
    });

    res.json(successResponse('Ride completed', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to complete ride'));
  }
};

const getDashboard = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;

    const { User } = await import('../models/User.model.js');
    const { Booking } = await import('../models/Booking.model.js');
    
    const [activeRides, completedRides, ambulance] = await Promise.all([
      bookingService.getActiveBookings(ambulanceId, 'provider'),
      Booking.countDocuments({
        provider: ambulanceId,
        serviceType: ServiceType.AMBULANCE,
        status: BookingStatus.COMPLETED,
      }),
      User.findById(ambulanceId).select('-password'),
    ]);

    const dashboardData = {
      activeRides: activeRides.length,
      totalRides: completedRides, // Use actual count from database
      completedRides: completedRides, // Add explicit completed rides count
      isAvailable: ambulance?.isAvailable || false,
      rating: ambulance?.rating || 0,
      vehicleType: ambulance?.vehicleType,
    };

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};

const getRideDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const { Booking } = await import('../models/Booking.model.js');
    
    const booking = await Booking.findOne({
      _id: id,
      provider: ambulanceId,
    }).populate('patient', 'firstName lastName phone email age gender');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    res.json(successResponse('Ride details fetched', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch ride details'));
  }
};

// ==================== NEW FUNCTIONS ====================

const updateLiveLocation = async (req, res) => {
  try {
    const ambulanceId = req.user.userId;
    const { latitude, longitude, bookingId } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json(errorResponse('Latitude and longitude are required'));
    }

    // Update ambulance location
    const { User } = await import('../models/User.model.js');
    await User.findByIdAndUpdate(ambulanceId, {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
        lastUpdated: new Date(),
      },
    });

    // Update location service
    await locationService.updateUserLocation(ambulanceId, latitude, longitude);

    // If bookingId provided, update booking and emit socket event
    if (bookingId) {
      const { Booking } = await import('../models/Booking.model.js');
      const booking = await Booking.findById(bookingId);

      if (booking && booking.provider.toString() === ambulanceId) {
        // Update booking with current location
        booking.providerLocation = {
          type: 'Point',
          coordinates: [longitude, latitude],
          lastUpdated: new Date(),
        };
        await booking.save();

        // Calculate ETA (simple distance-based calculation)
        const eta = calculateETA(
          { lat: latitude, lng: longitude },
          { 
            lat: booking.location?.coordinates?.[1] || booking.pickupLocation?.coordinates?.[1],
            lng: booking.location?.coordinates?.[0] || booking.pickupLocation?.coordinates?.[0]
          }
        );

        // Emit socket event to patient
        try {
          const { getSocketHandler } = await import('../socket/socket.handler.js');
          const socketHandler = getSocketHandler();
          
          socketHandler.emitToBooking(bookingId, 'ambulance:location:update', {
            latitude,
            longitude,
            eta,
            timestamp: new Date(),
          });

          socketHandler.emitToUser(booking.patient.toString(), 'ambulance:location:update', {
            bookingId,
            latitude,
            longitude,
            eta,
            timestamp: new Date(),
          });
        } catch (socketError) {
          console.error('Socket emit error:', socketError.message);
          // Continue even if socket fails
        }

        return res.json(successResponse('Live location updated', {
          latitude,
          longitude,
          eta,
          timestamp: new Date(),
        }));
      }
    }

    res.json(successResponse('Location updated', {
      latitude,
      longitude,
      timestamp: new Date(),
    }));
  } catch (error) {
    console.error('Live location update error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update live location'));
  }
};

const markPatientLoaded = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const { Booking } = await import('../models/Booking.model.js');
    const booking = await Booking.findOne({
      _id: id,
      provider: ambulanceId,
    });

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.status !== 'in_progress') {
      return res.status(400).json(errorResponse('Invalid status transition'));
    }

    booking.status = 'patient_loaded';
    booking.patientLoadedAt = new Date();
    await booking.save();

    // Emit socket event
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      
      socketHandler.emitToUser(booking.patient.toString(), 'ambulance:patient:loaded', {
        bookingId: id,
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    res.json(successResponse('Patient loaded', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update status'));
  }
};

const markHospitalReached = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;
    const { hospitalName, hospitalAddress } = req.body;

    const { Booking } = await import('../models/Booking.model.js');
    const booking = await Booking.findOne({
      _id: id,
      provider: ambulanceId,
    });

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.status !== 'patient_loaded') {
      return res.status(400).json(errorResponse('Invalid status transition'));
    }

    booking.status = 'hospital_reached';
    booking.hospitalReachedAt = new Date();
    booking.hospitalDetails = {
      name: hospitalName,
      address: hospitalAddress,
    };
    await booking.save();

    // Emit socket event
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      
      socketHandler.emitToUser(booking.patient.toString(), 'ambulance:hospital:reached', {
        bookingId: id,
        hospitalName,
        hospitalAddress,
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    res.json(successResponse('Hospital reached', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update status'));
  }
};

// Helper function to calculate ETA
function calculateETA(from, to) {
  if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
    return null;
  }

  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  // Assume average speed of 40 km/h in city traffic
  const averageSpeed = 40;
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = Math.ceil(timeInHours * 60);

  return {
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    eta: timeInMinutes,
    unit: 'minutes'
  };
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

export {
  updateProfile,
  updateLocation,
  setAvailability,
  getRideRequests,
  getRideDetails,
  acceptRide,
  startRide,
  arriveAtPickup,
  completeRide,
  getDashboard,
  updateLiveLocation,
  markPatientLoaded,
  markHospitalReached,
};