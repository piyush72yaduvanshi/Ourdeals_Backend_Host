import { realTimeBookingService } from '../services/realTimeBooking.service.js';
import { locationService } from '../services/location.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';

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

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');

    // TEMPORARY FIX: Add this ambulance to existing bookings that have empty notifiedProviders
    const bookingsToFix = await RealTimeBooking.find({
      serviceType: 'ambulance',
      status: 'requested',
      notifiedProviders: { $size: 0 }
    });

    if (bookingsToFix.length > 0) {
      await RealTimeBooking.updateMany(
        {
          serviceType: 'ambulance',
          status: 'requested',
          notifiedProviders: { $size: 0 }
        },
        {
          $push: {
            notifiedProviders: {
              provider: ambulanceId,
              notifiedAt: new Date(),
              viewed: false
            }
          }
        }
      );
    }

    // Build query — show requests notified to this ambulance OR accepted by this ambulance
    const query = {
      serviceType: 'ambulance',
      $or: [
        { acceptedProvider: ambulanceId },
        {
          'notifiedProviders.provider': ambulanceId,
          status: { $in: ['pending', 'requested'] },
          acceptedProvider: null,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      ],
      status: { $nin: ['cancelled', 'expired'] },
    };

    // Override status filter if explicitly provided
    if (status && status !== 'all') {
      delete query.status;
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate('patient', 'firstName lastName phone email gender age profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

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

    // Delegate to realTimeBookingService which handles race conditions atomically
    const booking = await realTimeBookingService.acceptBooking(id, ambulanceId);

    res.json(successResponse('Ride accepted', booking));
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(error.status || error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept ride'));
  }
};

const startRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const booking = await RealTimeBooking.findOne({ 
      _id: id, 
      acceptedProvider: ambulanceId,
      status: 'accepted'
    });
    
    if (!booking) return res.status(404).json(errorResponse('Booking not found'));
    if (booking.status !== 'accepted') return res.status(400).json(errorResponse(`Cannot start ride. Current status: ${booking.status}`));

    booking.status = 'on_the_way';
    booking.onTheWayAt = new Date();
    booking.startTime = new Date();
    await booking.save();

    // Emit status update to patient
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      socketHandler.emitToUser(booking.patient.toString(), 'booking:status:updated', {
        bookingId: id,
        status: 'on_the_way',
        message: 'Ambulance is on the way',
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    await booking.populate('patient', 'firstName lastName phone email');
    res.json(successResponse('Ride started - On the way', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to start ride'));
  }
};

const arriveAtPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const booking = await RealTimeBooking.findOne({ 
      _id: id, 
      acceptedProvider: ambulanceId,
      status: 'on_the_way'
    });
    
    if (!booking) return res.status(404).json(errorResponse('Booking not found'));
    if (booking.status !== 'on_the_way') return res.status(400).json(errorResponse(`Cannot arrive at pickup. Current status: ${booking.status}`));

    booking.status = 'in_progress';
    booking.atPickupAt = new Date();
    await booking.save();

    // Emit status update to patient
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      socketHandler.emitToUser(booking.patient.toString(), 'booking:status:updated', {
        bookingId: id,
        status: 'in_progress',
        message: 'Ambulance has arrived at pickup point',
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    await booking.populate('patient', 'firstName lastName phone email');
    res.json(successResponse('Arrived at pickup point', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to update status'));
  }
};

const completeRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ambulanceId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const booking = await RealTimeBooking.findOne({ 
      _id: id, 
      acceptedProvider: ambulanceId,
      status: 'in_progress'
    });
    
    if (!booking) return res.status(404).json(errorResponse('Booking not found'));
    if (booking.status !== 'in_progress') return res.status(400).json(errorResponse(`Cannot complete ride. Current status: ${booking.status}`));

    booking.status = 'completed';
    booking.atDropAt = new Date();
    booking.endTime = new Date();
    await booking.save();

    // Increment totalRides
    const { User } = await import('../models/User.model.js');
    await User.findByIdAndUpdate(ambulanceId, { $inc: { totalRides: 1 } });

    // Emit status update to patient
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      socketHandler.emitToUser(booking.patient.toString(), 'booking:status:updated', {
        bookingId: id,
        status: 'completed',
        message: 'Service completed. Ambulance has reached the drop point.',
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    await booking.populate('patient', 'firstName lastName phone email');
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
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    
    const [activeRides, completedRides, ambulance] = await Promise.all([
      RealTimeBooking.countDocuments({
        acceptedProvider: ambulanceId,
        serviceType: 'ambulance',
        status: { $in: ['accepted', 'on_the_way', 'in_progress'] },
      }),
      RealTimeBooking.countDocuments({
        acceptedProvider: ambulanceId,
        serviceType: 'ambulance',
        status: 'completed',
      }),
      User.findById(ambulanceId).select('-password'),
    ]);

    const dashboardData = {
      activeRides,
      totalRides: completedRides,
      completedRides,
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

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    
    // Check if booking exists and ambulance has access to it
    const booking = await RealTimeBooking.findOne({
      _id: id,
      $or: [
        { acceptedProvider: ambulanceId },
        { 'notifiedProviders.provider': ambulanceId }
      ]
    }).populate('patient', 'firstName lastName phone email age gender');

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found or access denied'));
    }

    res.json(successResponse('Ride details fetched', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch ride details'));
  }
};

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
      const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
      const booking = await RealTimeBooking.findById(bookingId);

      if (booking && booking.acceptedProvider.toString() === ambulanceId) {
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
            lat: booking.location?.coordinates?.[1],
            lng: booking.location?.coordinates?.[0]
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

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const booking = await RealTimeBooking.findOne({
      _id: id,
      acceptedProvider: ambulanceId,
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

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const booking = await RealTimeBooking.findOne({
      _id: id,
      acceptedProvider: ambulanceId,
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