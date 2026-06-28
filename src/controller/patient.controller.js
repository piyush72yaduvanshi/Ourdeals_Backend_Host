import { locationService } from '../services/location.service.js';
import { bookingService } from '../services/booking.service.js';
import { notificationService } from '../services/notification.service.js';
import { s3Service } from '../services/s3.service.js';
import { realTimeBookingService } from '../services/realTimeBooking.service.js';
import { RealTimeBooking } from '../models/RealTimeBooking.model.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType } from '../types/index.js';

const getNearbyServices = async (req, res) => {
  try {
    const { latitude, longitude, specialization, bloodGroup, serviceType } = req.query;

    // Create location object only if coordinates are provided
    let location = null;
    if (latitude && longitude) {
      location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    }

    // If serviceType is specified, return only that service type
    if (serviceType) {
      let services = [];
      
      switch (serviceType.toLowerCase()) {
        case 'doctor':
          services = await locationService.findDoctorsNearby(location, specialization);
          return res.json(successResponse('Doctors fetched', { doctors: services }));
        
        case 'nurse':
          services = await locationService.findNursesNearby(location);
          return res.json(successResponse('Nurses fetched', { nurses: services }));
        
        case 'ambulance':
          services = await locationService.findAmbulancesNearby(location);
          return res.json(successResponse('Ambulances fetched', { ambulances: services }));
        
        case 'pharmacist':
        case 'pharmacy':
          services = await locationService.findPharmaciesNearby(location);
          return res.json(successResponse('Pharmacies fetched', { pharmacies: services }));
        
        case 'bloodbank':
          services = await locationService.findBloodBanksNearby(location, bloodGroup);
          return res.json(successResponse('Blood banks fetched', { bloodBanks: services }));
        
        case 'pathology':
        case 'lab':
          services = await locationService.findPathologyLabsNearby(location);
          return res.json(successResponse('Labs fetched', { labs: services }));
        
        default:
          return res.status(400).json(errorResponse('Invalid service type'));
      }
    }

    // Return all services if no specific type requested
    const [
      doctors,
      nurses,
      pharmacies,
      ambulances,
      bloodBanks,
      labs,
    ] = await Promise.all([
      locationService.findDoctorsNearby(location, specialization),
      locationService.findNursesNearby(location),
      locationService.findPharmaciesNearby(location),
      locationService.findAmbulancesNearby(location),
      locationService.findBloodBanksNearby(location, bloodGroup),
      locationService.findPathologyLabsNearby(location),
    ]);

    const results = {
      doctors,
      nurses,
      pharmacies,
      ambulances,
      bloodBanks,
      labs,
    };

    const message = location 
      ? 'Nearby services fetched' 
      : 'All available services fetched';

    res.json(successResponse(message, results));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch services'));
  }
};

const createBooking = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    console.log('=== INCOMING REQUEST ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    let bookingData = { ...req.body, patient: patientId };
    
    console.log('=== AFTER SPREAD ===');
    console.log('bookingData:', JSON.stringify(bookingData, null, 2));
    console.log('bloodGroup:', bookingData.bloodGroup);
    console.log('unitsRequired:', bookingData.unitsRequired);
    
    // Convert unitsRequired to number for blood bank bookings
    if (bookingData.serviceType === 'bloodbank' && bookingData.unitsRequired) {
      bookingData.unitsRequired = Number(bookingData.unitsRequired);
    }
    
    console.log('=== BEFORE SERVICE CALL ===');
    console.log('bloodGroup:', bookingData.bloodGroup);
    console.log('unitsRequired:', bookingData.unitsRequired);

    // Auto-assign nearest provider for ambulance requests if provider not specified
    if (bookingData.serviceType === 'ambulance' && !bookingData.provider) {
      try {
        // Extract coordinates from location
        let latitude, longitude;
        
        if (bookingData.location?.coordinates) {
          [longitude, latitude] = bookingData.location.coordinates;
        } else if (bookingData.latitude && bookingData.longitude) {
          latitude = bookingData.latitude;
          longitude = bookingData.longitude;
        } else {
          return res.status(400).json(errorResponse('Location coordinates required for ambulance booking'));
        }

        const ambulances = await locationService.findAmbulancesNearby({
          latitude,
          longitude,
        });

        if (!ambulances.length) {
          return res.status(404).json(errorResponse('No ambulances available nearby'));
        }

        bookingData.provider = ambulances[0]._id.toString();
        
        // Ensure location has the correct format for booking
        if (!bookingData.location.address) {
          bookingData.location.address = bookingData.address || 'Emergency location';
        }
        
      } catch (locationError) {
        return res.status(500).json(errorResponse('Failed to find nearby ambulances: ' + locationError.message));
      }
    }

    // For medicine/pharmacy orders, don't assign provider - let pharmacists accept
    if (bookingData.serviceType === 'pharmacist' || bookingData.serviceType === 'pharmacy') {
      delete bookingData.provider; // Remove provider if sent
    }

    const booking = await bookingService.createBooking(bookingData);
    res.status(201).json(successResponse('Booking created successfully', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to create booking'));
  }
};

const getBookings = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { status, serviceType, page, limit } = req.query;

    const filters = {
      status,
      serviceType,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const { bookings, total } = await bookingService.getUserBookings(
      patientId,
      'patient',
      filters
    );

    res.json(
      paginatedResponse(
        'Bookings fetched successfully',
        bookings,
        filters.page,
        filters.limit,
        total
      )
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch bookings'));
  }
};


const getActiveBookings = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const bookings = await bookingService.getActiveBookings(patientId);

    res.json(successResponse('Active bookings fetched', bookings));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch active bookings'));
  }
};

const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await bookingService.getBooking(id);

    res.json(successResponse('Booking details fetched', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to fetch booking'));
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const patientId = req.user.userId;

    const booking = await bookingService.cancelBooking(id, patientId, reason);

    res.json(successResponse('Booking cancelled successfully', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to cancel booking'));
  }
};

const addRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const patientId = req.user.userId;

    await bookingService.addRating(id, patientId, rating, review);

    res.json(successResponse('Rating added successfully'));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to add rating'));
  }
};

const triggerEmergency = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    // Log the incoming request body for debugging
    console.log('=== EMERGENCY REQUEST START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    let { latitude, longitude, address, notes, location, type } = req.body;

    // Validate emergency type (default to ambulance for backward compatibility)
    const emergencyType = type || 'ambulance';
    if (!['doctor', 'ambulance'].includes(emergencyType)) {
      console.log('ERROR: Invalid emergency type:', emergencyType);
      return res.status(400).json(errorResponse('Emergency type must be either "doctor" or "ambulance"'));
    }

    console.log('Emergency type:', emergencyType);

    // Support both GeoJSON format and separate lat/lng fields
    if (location?.type === 'Point' && location?.coordinates) {
      [longitude, latitude] = location.coordinates;
      console.log('Extracted coordinates from GeoJSON:', { longitude, latitude });
    }

    // Validate that we have coordinates
    if (!latitude || !longitude) {
      console.log('ERROR: Missing coordinates');
      return res.status(400).json(errorResponse('Location coordinates are required for emergency requests'));
    }

    console.log('Searching for', emergencyType, 'near:', { latitude, longitude });

    let provider;
    let serviceType;
    let consultationType;
    let eta;

    if (emergencyType === 'doctor') {
      // EMERGENCY DOCTOR VIDEO CALL
      serviceType = ServiceType.DOCTOR;
      consultationType = 'video-call';

      // Find available doctors
      let doctors = await locationService.findDoctorsNearby({
        latitude,
        longitude,
        maxDistance: 50, // 50km radius
      });

      console.log(`Found ${doctors.length} doctors within 50km`);

      // FALLBACK: If no nearby doctors, get ANY available doctor
      if (!doctors.length) {
        console.log('No nearby doctors found, searching for ANY available doctor...');
        
        const { Doctor } = await import('../models/Doctor.model.js');
        doctors = await Doctor.find({
          status: 'approved',
          role: 'doctor',
        })
          .select('-password')
          .limit(10)
          .sort({ rating: -1, totalConsultations: -1 });
        
        console.log(`Found ${doctors.length} available doctors (fallback - any location)`);
      }

      // If still no doctors, return error
      if (!doctors.length) {
        console.log('ERROR: No doctors available at all');
        return res.status(404).json(errorResponse('No doctors available for emergency video consultation. Please try again or visit nearest hospital.'));
      }

      provider = doctors[0];
      eta = 5; // Video call can start in 5 minutes

      console.log('Selected doctor:', {
        id: provider._id,
        name: provider.firstName + ' ' + provider.lastName,
        specialization: provider.specialization,
        rating: provider.rating,
        eta: `${eta} minutes`
      });

    } else {
      // EMERGENCY AMBULANCE
      serviceType = ServiceType.AMBULANCE;
      consultationType = undefined; // No consultation type for ambulance

      // Find available ambulances
      let ambulances = await locationService.findAmbulancesNearby({
        latitude,
        longitude,
        maxDistance: 50, // 50km radius
      });

      console.log(`Found ${ambulances.length} ambulances within 50km`);

      // FALLBACK: If no nearby ambulances, get ANY available ambulance
      if (!ambulances.length) {
        console.log('No nearby ambulances found, searching for ANY available ambulance...');
        
        const { Ambulance } = await import('../models/Ambulance.model.js');
        ambulances = await Ambulance.find({
          status: 'approved',
          role: 'ambulance',
          isAvailable: true,
        })
          .select('-password')
          .limit(10)
          .sort({ rating: -1, totalRides: -1 });
        
        console.log(`Found ${ambulances.length} available ambulances (fallback - any location)`);
      }

      // If still no ambulances, return error
      if (!ambulances.length) {
        console.log('ERROR: No ambulances available at all');
        return res.status(404).json(errorResponse('No ambulances available at the moment. Please try again or call 108 directly.'));
      }

      provider = ambulances[0];
      
      // Calculate ETA (default to 15 minutes if no distance)
      eta = provider.distance 
        ? locationService.calculateETA(provider.distance)
        : 15; // Default 15 minutes

      console.log('Selected ambulance:', {
        id: provider._id,
        driverName: provider.driverName,
        vehicleNumber: provider.vehicleNumber,
        distance: provider.distance || 'unknown',
        eta: `${eta} minutes`
      });
    }

    // Create booking data
    const bookingData = {
      patient: patientId,
      provider: provider._id.toString(),
      serviceType: serviceType,
      location: {
        address: address || 'Emergency location',
        coordinates: [longitude, latitude],
      },
      notes: `EMERGENCY ${emergencyType.toUpperCase()}: ${notes || 'Immediate assistance required'}`,
      price: emergencyType === 'ambulance' ? 500 : 0, // Base emergency ambulance fare: ₹500
      isEmergency: true,
    };

    // Add consultationType only for doctor
    if (consultationType) {
      bookingData.consultationType = consultationType;
    }

    console.log('Creating booking with data:', JSON.stringify(bookingData, null, 2));

    const booking = await bookingService.createBooking(bookingData);

    await notificationService.sendEmergencyAlert(
      provider._id.toString(),
      `Emergency ${emergencyType} request from ${address || 'Emergency location'}. ETA: ${eta} minutes`
    );

    // Emit socket events
    try {
      const { getSocketHandler } = await import('../socket/socket.handler.js');
      const socketHandler = getSocketHandler();
      
      // Alert provider
      socketHandler.emitToUser(provider._id.toString(), 'emergency:alert', {
        bookingId: booking._id,
        emergencyType,
        location: { latitude, longitude, address },
        notes,
        eta,
        timestamp: new Date(),
      });

      // Confirm to patient
      socketHandler.emitToUser(patientId, 'emergency:confirmed', {
        bookingId: booking._id,
        emergencyType,
        provider: {
          id: provider._id,
          name: provider.firstName + ' ' + provider.lastName,
        },
        eta,
        timestamp: new Date(),
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError.message);
    }

    console.log('Emergency booking created successfully:', {
      bookingId: booking._id,
      providerId: provider._id,
      serviceType: serviceType,
      emergencyType: emergencyType,
      eta: `${eta} minutes`
    });
    console.log('=== EMERGENCY REQUEST END ===');

    // Prepare response based on emergency type
    const responseData = {
      booking,
      eta,
      emergencyType,
    };

    if (emergencyType === 'doctor') {
      responseData.doctor = {
        id: provider._id,
        name: provider.firstName + ' ' + provider.lastName,
        specialization: provider.specialization,
        phoneNumber: provider.phoneNumber,
        rating: provider.rating,
        consultationType: 'video-call',
      };
    } else {
      responseData.ambulance = {
        id: provider._id,
        driverName: provider.driverName,
        vehicleNumber: provider.vehicleNumber,
        phoneNumber: provider.phoneNumber,
        rating: provider.rating,
        distance: provider.distance || null,
      };
    }

    res.status(201).json(
      successResponse(
        emergencyType === 'doctor' 
          ? 'Emergency doctor consultation requested! Doctor will connect via video call shortly.'
          : 'Emergency ambulance requested! Ambulance is on the way.',
        responseData
      )
    );
  } catch (error) {
    console.error('=== EMERGENCY REQUEST ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json(errorResponse(error.message || 'Failed to trigger emergency'));
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { notifications, total } =
      await notificationService.getUserNotifications(userId, page, limit);

    res.json(
      paginatedResponse('Notifications fetched', notifications, page, limit, total)
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch notifications'));
  }
};
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id);

    res.json(successResponse('Notification marked as read'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to mark notification'));
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await notificationService.getUnreadCount(userId);

    res.json(successResponse('Unread count fetched', { count }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to get unread count'));
  }
};


// ==================== SEARCH FUNCTIONALITY ====================

const searchDoctors = async (req, res) => {
  try {
    const {
      search,
      specialization,
      category, // ADDED: Filter by category (maps to specialization)
      minFee,
      maxFee,
      experience,
      languages,
      consultationType, // NEW: Filter by consultation type
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 10,
    } = req.query;

    // Validate coordinates if provided
    if ((latitude !== undefined && latitude !== '') || (longitude !== undefined && longitude !== '')) {
      // Check if both are provided when one is provided
      if ((latitude && !longitude) || (!latitude && longitude)) {
        return res.status(400).json(
          errorResponse('Both latitude and longitude must be provided together')
        );
      }
      
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
          return res.status(400).json(
            errorResponse('Invalid coordinates: latitude and longitude must be valid numbers')
          );
        }
        
        if (lat < -90 || lat > 90) {
          return res.status(400).json(
            errorResponse('Invalid latitude: must be between -90 and 90')
          );
        }
        
        if (lng < -180 || lng > 180) {
          return res.status(400).json(
            errorResponse('Invalid longitude: must be between -180 and 180')
          );
        }
      }
    }

    const query = { status: 'approved', role: 'doctor' };
    const andConditions = [];

    // Text search on name
    if (search) {
      andConditions.push({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { specialization: { $regex: search, $options: 'i' } },
        ]
      });
    }

    // Filter by specialization or category
    if (specialization || category) {
      const filterValue = specialization || category;
      andConditions.push({
        $or: [
          { specialization: { $regex: filterValue, $options: 'i' } },
          { category: { $regex: filterValue, $options: 'i' } }
        ]
      });
    }
    
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Filter by consultation fee range
    if (minFee || maxFee) {
      query.consultationFee = {};
      if (minFee) query.consultationFee.$gte = Number(minFee);
      if (maxFee) query.consultationFee.$lte = Number(maxFee);
    }

    // Filter by experience
    if (experience) {
      query.experience = { $gte: Number(experience) };
    }

    // Filter by languages
    if (languages) {
      const langArray = languages.split(',').map(l => l.trim());
      query.languages = { $in: langArray };
    }

    // Filter by consultation type (NEW)
    if (consultationType) {
      query.consultationTypes = consultationType; // Doctor must offer this type
    }

    const skip = (Number(page) - 1) * Number(limit);

    let doctors;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const { Doctor } = await import('../models/Doctor.model.js');
      
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000, // Convert km to meters
          },
        },
      };

      // $near already sorts by distance, so don't add .sort()
      [doctors, total] = await Promise.all([
        Doctor.find(geoQuery)
          .select('-password')
          .skip(skip)
          .limit(Number(limit)),
        Doctor.countDocuments(query), // Count without $near
      ]);

      // Calculate distance for each doctor
      const { calculateDistance } = await import('../utils/geolocation.util.js');
      doctors = doctors.map((doctor) => {
        const docObj = doctor.toObject();
        if (docObj.location?.coordinates) {
          const distance = calculateDistance(
            { latitude: Number(latitude), longitude: Number(longitude) },
            {
              latitude: docObj.location.coordinates[1],
              longitude: docObj.location.coordinates[0],
            },
          );
          docObj.distance = Number(distance.toFixed(2));
        }
        return docObj;
      });
    } else {
      // Regular search without location
      const { Doctor } = await import('../models/Doctor.model.js');
      
      [doctors, total] = await Promise.all([
        Doctor.find(query)
          .select('-password')
          .skip(skip)
          .limit(Number(limit))
          .sort({ rating: -1, totalConsultations: -1 }),
        Doctor.countDocuments(query),
      ]);
    }

    return res.json(
      paginatedResponse('Doctors found', doctors, Number(page), Number(limit), total)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search doctors')
    );
  }
};

const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Doctor } = await import('../models/Doctor.model.js');
    
    const doctor = await Doctor.findById(id).select('-password');
    if (!doctor) {
      return res.status(404).json(errorResponse('Doctor not found'));
    }
    
    return res.json(successResponse('Doctor details fetched successfully', doctor));
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch doctor details')
    );
  }
};

const searchMedicines = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      requiresPrescription,
      inStock,
      page = 1,
      limit = 20,
    } = req.query;

    const { Medicine } = await import('../models/Medicine.model.js');

    const query = { isActive: true };

    // Text search on name, generic name
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by category
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Filter by prescription requirement
    if (requiresPrescription !== undefined) {
      query.requiresPrescription = requiresPrescription === 'true';
    }

    // Filter by stock availability
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [medicines, total] = await Promise.all([
      Medicine.find(query)
        .populate('pharmacist', 'firstName lastName pharmacyName phone address city')
        .skip(skip)
        .limit(Number(limit))
        .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }),
      Medicine.countDocuments(query),
    ]);

    // Generate signed URLs for medicine images
    const medicinesWithSignedUrls = await Promise.all(
      medicines.map(async (medicine) => {
        const medicineObj = medicine.toObject();
        
        // Generate signed URL for main image
        if (medicineObj.imageUrl) {
          medicineObj.imageUrlSigned = await s3Service.getSignedUrl(medicineObj.imageUrl);
        }
        
        // Generate signed URLs for all images
        if (medicineObj.images && medicineObj.images.length > 0) {
          medicineObj.imagesSigned = await Promise.all(
            medicineObj.images.map(imageUrl => s3Service.getSignedUrl(imageUrl))
          );
        }
        
        return medicineObj;
      })
    );

    res.json(paginatedResponse('Medicines fetched', medicinesWithSignedUrls, page, limit, total));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to search medicines'));
  }
};

// Get medicine details by ID (NO AUTH REQUIRED - public endpoint)
const getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Medicine } = await import('../models/Medicine.model.js');

    const medicine = await Medicine.findById(id)
      .populate('pharmacist', 'firstName lastName pharmacyName phone address city location email');

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    if (!medicine.isActive) {
      return res.status(404).json(errorResponse('Medicine is not available'));
    }

    // Generate signed URLs for medicine images
    const medicineObj = medicine.toObject();
    
    // Generate signed URL for main image
    if (medicineObj.imageUrl) {
      medicineObj.imageUrlSigned = await s3Service.getSignedUrl(medicineObj.imageUrl);
    }
    
    // Generate signed URLs for all images
    if (medicineObj.images && medicineObj.images.length > 0) {
      medicineObj.imagesSigned = await Promise.all(
        medicineObj.images.map(imageUrl => s3Service.getSignedUrl(imageUrl))
      );
    }

    res.json(successResponse('Medicine details fetched', medicineObj));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch medicine details'));
  }
};

const searchPharmacies = async (req, res) => {
  try {
    const {
      search,
      deliveryAvailable,
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 10,
    } = req.query;

    const { Pharmacist } = await import('../models/Pharmacist.model.js');

    const query = { status: 'approved', role: 'pharmacist' };

    // Text search on pharmacy name
    if (search) {
      query.$or = [
        { pharmacyName: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by delivery availability
    if (deliveryAvailable === 'true') {
      query['deliveryTimes.0'] = { $exists: true };
    }

    const skip = (Number(page) - 1) * Number(limit);

    let pharmacies;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000,
          },
        },
      };

      // $near already sorts by distance, so don't add .sort()
      [pharmacies, total] = await Promise.all([
        Pharmacist.find(geoQuery)
          .select('-password')
          .skip(skip)
          .limit(Number(limit)),
        Pharmacist.countDocuments(query), // Count without $near
      ]);
    } else {
      [pharmacies, total] = await Promise.all([
        Pharmacist.find(query)
          .select('-password')
          .skip(skip)
          .limit(Number(limit))
          .sort({ rating: -1 }),
        Pharmacist.countDocuments(query),
      ]);
    }

    return res.json(
      paginatedResponse('Pharmacies found', pharmacies, Number(page), Number(limit), total)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search pharmacies')
    );
  }
};

const searchPathologyLabs = async (req, res) => {
  try {
    const {
      search,
      testName,
      homeCollection,
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 10,
    } = req.query;

    const { Pathology } = await import('../models/Pathology.model.js');

    const query = { status: 'approved', role: 'pathology' };

    // Text search on lab name
    if (search) {
      query.$or = [
        { labName: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by specific test
    if (testName) {
      query['testsOffered.name'] = { $regex: testName, $options: 'i' };
    }

    // Filter by home collection availability
    if (homeCollection === 'true') {
      query.homeCollectionAvailable = true;
    }

    const skip = (Number(page) - 1) * Number(limit);

    let labs;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000,
          },
        },
      };

      // $near already sorts by distance, so don't add .sort()
      [labs, total] = await Promise.all([
        Pathology.find(geoQuery)
          .select('-password')
          .skip(skip)
          .limit(Number(limit)),
        Pathology.countDocuments(query), // Count without $near
      ]);
    } else {
      [labs, total] = await Promise.all([
        Pathology.find(query)
          .select('-password')
          .skip(skip)
          .limit(Number(limit))
          .sort({ rating: -1 }),
        Pathology.countDocuments(query),
      ]);
    }

    return res.json(
      paginatedResponse('Pathology labs found', labs, Number(page), Number(limit), total)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search pathology labs')
    );
  }
};

const searchBloodBanks = async (req, res) => {
  try {
    const {
      search,
      bloodGroup,
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 10,
    } = req.query;

    const { BloodBank } = await import('../models/BloodBank.model.js');

    const query = { status: 'approved', role: 'bloodbank' };

    // Text search on bank name
    if (search) {
      query.$or = [
        { bankName: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by blood group availability
    if (bloodGroup) {
      query['bloodStock'] = {
        $elemMatch: {
          bloodGroup: bloodGroup,
          unitsAvailable: { $gt: 0 },
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    let bloodBanks;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000,
          },
        },
      };

      // $near already sorts by distance, so don't add .sort()
      [bloodBanks, total] = await Promise.all([
        BloodBank.find(geoQuery)
          .select('-password')
          .skip(skip)
          .limit(Number(limit)),
        BloodBank.countDocuments(query), // Count without $near for accurate total
      ]);
    } else {
      [bloodBanks, total] = await Promise.all([
        BloodBank.find(query)
          .select('-password')
          .skip(skip)
          .limit(Number(limit))
          .sort({ rating: -1 }),
        BloodBank.countDocuments(query),
      ]);
    }

    return res.json(
      paginatedResponse('Blood banks found', bloodBanks, Number(page), Number(limit), total)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search blood banks')
    );
  }
};

// ==================== NURSE SEARCH ====================
const searchNurses = async (req, res) => {
  try {
    const {
      search,
      specialization,
      minFee,
      maxFee,
      experience,
      serviceType,
      consultationType, // NEW: Filter by consultation type
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 10,
    } = req.query;

    const { Nurse } = await import('../models/Nurse.model.js');

    const query = { status: 'approved', role: 'nurse' };

    // Text search on name
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { specializations: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by specialization
    if (specialization) {
      query.specializations = { $regex: specialization, $options: 'i' };
    }

    // Filter by service type (e.g., Home Care, ICU Care)
    if (serviceType) {
      query['servicesOffered.name'] = { $regex: serviceType, $options: 'i' };
    }

    // Filter by price range (per hour)
    if (minFee || maxFee) {
      query['servicesOffered.pricePerHour'] = {};
      if (minFee) query['servicesOffered.pricePerHour'].$gte = Number(minFee);
      if (maxFee) query['servicesOffered.pricePerHour'].$lte = Number(maxFee);
    }

    // Filter by experience
    if (experience) {
      query.experience = { $gte: Number(experience) };
    }

    // Filter by consultation type (NEW)
    if (consultationType) {
      query.consultationTypes = consultationType; // Nurse must offer this type
    }

    const skip = (Number(page) - 1) * Number(limit);

    let nurses;
    let total;

    // Location-based search
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000, // Convert km to meters
          },
        },
      };

      [nurses, total] = await Promise.all([
        Nurse.find(geoQuery)
          .select('-password')
          .skip(skip)
          .limit(Number(limit)),
        Nurse.countDocuments(query),
      ]);
    } else {
      // Regular search without location
      [nurses, total] = await Promise.all([
        Nurse.find(query)
          .select('-password')
          .skip(skip)
          .limit(Number(limit))
          .sort({ rating: -1, totalVisits: -1 }),
        Nurse.countDocuments(query),
      ]);
    }

    return res.json(
      paginatedResponse('Nurses found', nurses, Number(page), Number(limit), total)
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search nurses')
    );
  }
};

// ==================== AMBULANCE SEARCH ====================
const searchAmbulances = async (req, res) => {
  try {
    const {
      search,
      vehicleType,
      isAvailable,
      page = 1,
      limit = 20,
      latitude,
      longitude,
      maxDistance = 50, // Default 50km
    } = req.query;

    const { User } = await import('../models/User.model.js');

    const query = { status: 'approved', role: 'ambulance' };

    // Text search on name fields (User model has firstName, lastName)
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    let ambulances;
    let total;

    // Location-based search (using location field from User model)
    if (latitude && longitude) {
      const geoQuery = {
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: Number(maxDistance) * 1000, // Convert km to meters
          },
        },
      };

      try {
        [ambulances, total] = await Promise.all([
          User.find(geoQuery)
            .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire')
            .skip(skip)
            .limit(Number(limit)),
          User.countDocuments(query),
        ]);

        // Add distance and mock ambulance-specific fields
        ambulances = ambulances.map(amb => {
          const ambObj = amb.toObject();
          
          // Calculate distance
          if (ambObj.location && ambObj.location.coordinates) {
            const distance = calculateDistance(
              Number(latitude),
              Number(longitude),
              ambObj.location.coordinates[1],
              ambObj.location.coordinates[0]
            );
            ambObj.distance = distance;
          }
          
          // Add mock ambulance-specific fields (until we add them to schema)
          ambObj.driverName = `${ambObj.firstName} ${ambObj.lastName}`;
          ambObj.vehicleNumber = `AMB-${ambObj.phone.slice(-4)}`;
          ambObj.vehicleType = vehicleType || 'Basic Life Support';
          ambObj.isAvailable = true;
          ambObj.equipmentAvailable = ['Oxygen Cylinder', 'Stretcher', 'First Aid Kit', 'Defibrillator'];
          ambObj.rating = 4.5;
          ambObj.totalRides = 150;
          
          return ambObj;
        });
      } catch (geoError) {
        console.error('Geo search error:', geoError);
        // Fallback to regular search if geo search fails
        [ambulances, total] = await Promise.all([
          User.find(query)
            .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 }),
          User.countDocuments(query),
        ]);
        
        // Add mock fields for fallback results too
        ambulances = ambulances.map(amb => {
          const ambObj = amb.toObject();
          ambObj.driverName = `${ambObj.firstName} ${ambObj.lastName}`;
          ambObj.vehicleNumber = `AMB-${ambObj.phone.slice(-4)}`;
          ambObj.vehicleType = vehicleType || 'Basic Life Support';
          ambObj.isAvailable = true;
          ambObj.equipmentAvailable = ['Oxygen Cylinder', 'Stretcher', 'First Aid Kit', 'Defibrillator'];
          ambObj.rating = 4.5;
          ambObj.totalRides = 150;
          return ambObj;
        });
      }
    } else {
      // Regular search without location
      [ambulances, total] = await Promise.all([
        User.find(query)
          .select('-password -refreshTokens -resetPasswordToken -resetPasswordExpire')
          .skip(skip)
          .limit(Number(limit))
          .sort({ createdAt: -1 }),
        User.countDocuments(query),
      ]);
      
      // Add mock fields
      ambulances = ambulances.map(amb => {
        const ambObj = amb.toObject();
        ambObj.driverName = `${ambObj.firstName} ${ambObj.lastName}`;
        ambObj.vehicleNumber = `AMB-${ambObj.phone.slice(-4)}`;
        ambObj.vehicleType = vehicleType || 'Basic Life Support';
        ambObj.isAvailable = true;
        ambObj.equipmentAvailable = ['Oxygen Cylinder', 'Stretcher', 'First Aid Kit', 'Defibrillator'];
        ambObj.rating = 4.5;
        ambObj.totalRides = 150;
        return ambObj;
      });
    }

    return res.json(
      paginatedResponse('Ambulances found', ambulances, Number(page), Number(limit), total)
    );
  } catch (error) {
    console.error('Search ambulances error:', error);
    return res.status(500).json(
      errorResponse(error.message || 'Failed to search ambulances')
    );
  }
};

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// ==================== GET NURSE DETAILS ====================
const getNurseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { Nurse } = await import('../models/Nurse.model.js');

    const nurse = await Nurse.findById(id).select('-password');

    if (!nurse) {
      return res.status(404).json(errorResponse('Nurse not found'));
    }

    return res.json(successResponse('Nurse details fetched', nurse));
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch nurse details')
    );
  }
};

// ==================== GET AMBULANCE DETAILS ====================
const getAmbulanceDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { Ambulance } = await import('../models/Ambulance.model.js');

    const ambulance = await Ambulance.findById(id).select('-password');

    if (!ambulance) {
      return res.status(404).json(errorResponse('Ambulance not found'));
    }

    return res.json(successResponse('Ambulance details fetched', ambulance));
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch ambulance details')
    );
  }
};

// ==================== GET NURSE AVAILABILITY ====================
const getNurseAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const { Nurse } = await import('../models/Nurse.model.js');

    const nurse = await Nurse.findById(id).select('availability firstName lastName');

    if (!nurse) {
      return res.status(404).json(errorResponse('Nurse not found'));
    }

    let availability = nurse.availability;

    // Filter by date range if provided
    if (startDate || endDate) {
      availability = availability.filter(slot => {
        const slotDate = new Date(slot.date);
        if (startDate && slotDate < new Date(startDate)) return false;
        if (endDate && slotDate > new Date(endDate)) return false;
        return true;
      });
    }

    return res.json(
      successResponse('Nurse availability fetched', {
        nurseId: nurse._id,
        nurseName: `${nurse.firstName} ${nurse.lastName}`,
        availability,
      })
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to fetch nurse availability')
    );
  }
};

const globalSearch = async (req, res) => {
  try {
    const { query, latitude, longitude } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json(
        errorResponse('Search query must be at least 2 characters')
      );
    }

    const location = latitude && longitude 
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;

    // Search across all service types
    const [doctors, medicines, pharmacies, labs, bloodBanks] = await Promise.all([
      searchDoctorsInternal(query, location),
      searchMedicinesInternal(query),
      searchPharmaciesInternal(query, location),
      searchPathologyLabsInternal(query, location),
      searchBloodBanksInternal(query, location),
    ]);

    // Generate signed URLs for medicine images
    const medicinesWithSignedUrls = await Promise.all(
      medicines.map(async (medicine) => {
        const medicineObj = medicine.toObject();
        
        // Generate signed URL for main image
        if (medicineObj.imageUrl) {
          medicineObj.imageUrlSigned = await s3Service.getSignedUrl(medicineObj.imageUrl);
        }
        
        // Generate signed URLs for all images
        if (medicineObj.images && medicineObj.images.length > 0) {
          medicineObj.imagesSigned = await Promise.all(
            medicineObj.images.map(imageUrl => s3Service.getSignedUrl(imageUrl))
          );
        }
        
        return medicineObj;
      })
    );

    const results = {
      doctors: doctors.slice(0, 5),
      medicines: medicinesWithSignedUrls.slice(0, 5),
      pharmacies: pharmacies.slice(0, 5),
      labs: labs.slice(0, 5),
      bloodBanks: bloodBanks.slice(0, 5),
      totalResults: doctors.length + medicines.length + pharmacies.length + labs.length + bloodBanks.length,
    };

    return res.json(successResponse('Search results', results));
  } catch (error) {
    return res.status(500).json(
      errorResponse(error.message || 'Failed to perform search')
    );
  }
};

// Helper functions for global search
async function searchDoctorsInternal(query, location) {
  const { Doctor } = await import('../models/Doctor.model.js');
  const searchQuery = {
    status: 'approved',
    role: 'doctor',
    $or: [
      { firstName: { $regex: query, $options: 'i' } },
      { lastName: { $regex: query, $options: 'i' } },
      { specialization: { $regex: query, $options: 'i' } },
    ],
  };

  return await Doctor.find(searchQuery)
    .select('-password')
    .limit(10)
    .sort({ rating: -1 });
}

async function searchMedicinesInternal(query) {
  const { Medicine } = await import('../models/Medicine.model.js');
  return await Medicine.find({
    isActive: true,
    $text: { $search: query },
  })
    .populate('pharmacist', 'pharmacyName phone')
    .limit(10)
    .sort({ score: { $meta: 'textScore' } });
}

async function searchPharmaciesInternal(query, location) {
  const { Pharmacist } = await import('../models/Pharmacist.model.js');
  return await Pharmacist.find({
    status: 'approved',
    role: 'pharmacist',
    pharmacyName: { $regex: query, $options: 'i' },
  })
    .select('-password')
    .limit(10)
    .sort({ rating: -1 });
}

async function searchPathologyLabsInternal(query, location) {
  const { Pathology } = await import('../models/Pathology.model.js');
  return await Pathology.find({
    status: 'approved',
    role: 'pathology',
    $or: [
      { labName: { $regex: query, $options: 'i' } },
      { 'testsOffered.name': { $regex: query, $options: 'i' } },
    ],
  })
    .select('-password')
    .limit(10)
    .sort({ rating: -1 });
}

async function searchBloodBanksInternal(query, location) {
  const { BloodBank } = await import('../models/BloodBank.model.js');
  return await BloodBank.find({
    status: 'approved',
    role: 'bloodbank',
    bankName: { $regex: query, $options: 'i' },
  })
    .select('-password')
    .limit(10)
    .sort({ rating: -1 });
}

// Prescription endpoints
const createPrescriptionOrder = async (req, res, next) => {
  try {
    const { 
      location, 
      patientName, 
      patientPhone, 
      requirements = "Prescription Medicine Order" 
    } = req.body;

    const prescriptionImages = [];
    
    // Process uploaded images
    let uploadedImages = [];
    if (Array.isArray(req.files)) {
      uploadedImages = req.files.filter(f => f.fieldname === 'prescriptionImages');
    } else if (req.files && req.files.prescriptionImages) {
      uploadedImages = req.files.prescriptionImages;
    }

    if (uploadedImages.length > 0) {
      try {
        // Use s3Service to upload multiple files
        const uploadResults = await s3Service.uploadMultipleFiles(uploadedImages, 'prescriptions', req.user.userId);
        
        // Extract only fileUrl string from each result object
        const urls = uploadResults.map(result => {
          // Ensure we're getting a string, not an object
          if (typeof result === 'string') {
            return result;
          }
          if (result && typeof result === 'object' && result.fileUrl) {
            return String(result.fileUrl);
          }
          console.warn('Unexpected result format:', result);
          return null;
        }).filter(url => url !== null);
        
        prescriptionImages.push(...urls);
      } catch (uploadError) {
        console.error('Prescription image upload error:', uploadError);
        return res.status(500).json(errorResponse('Failed to upload prescription images: ' + uploadError.message));
      }
    } else if (req.body.prescriptionImages) {
      // Allow fallback if they pass URLs as strings
      const passedImages = Array.isArray(req.body.prescriptionImages) 
        ? req.body.prescriptionImages 
        : [req.body.prescriptionImages];
      
      // Ensure all are strings
      const imageUrls = passedImages.map(img => String(img)).filter(img => img && img !== 'undefined');
      prescriptionImages.push(...imageUrls);
    }

    if (prescriptionImages.length === 0) {
      return res.status(400).json(errorResponse("At least one prescription image is required"));
    }
    
    // Final validation - ensure all items are strings
    const validatedImages = prescriptionImages.filter(img => typeof img === 'string' && img.length > 0);
    if (validatedImages.length === 0) {
      return res.status(400).json(errorResponse("No valid prescription images found"));
    }

    let parsedLocation = location;
    if (typeof location === 'string') {
      try {
        parsedLocation = JSON.parse(location);
      } catch (e) {
        parsedLocation = { address: location, coordinates: [0, 0] };
      }
    } else if (!location) {
      parsedLocation = { address: 'Address pending', coordinates: [0,0] };
    }

    const bookingData = {
      patient: req.user.userId,
      serviceType: "pharmacist",
      status: "requested",
      isPrescriptionBased: true,
      prescriptionImages: validatedImages, // Use validated images
      patientName: patientName || "Patient",
      patientPhone: patientPhone || "",
      location: parsedLocation,
      city: req.body.city || '', // IMPORTANT: City for vendor matching
      state: req.body.state || '', // IMPORTANT: State for vendor matching
      requirements: {
        description: typeof requirements === 'string' ? requirements : JSON.stringify(requirements)
      }
    };

    console.log('📍 Prescription Order Created:', {
      city: bookingData.city,
      state: bookingData.state,
      location: bookingData.location,
      isPrescriptionBased: bookingData.isPrescriptionBased
    });

    const booking = await realTimeBookingService.createRealTimeBooking(bookingData);
    
    res.status(201).json(successResponse("Prescription order sent to nearby pharmacies", { booking }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to create prescription order"));
  }
};

const getPrescriptionOffers = async (req, res, next) => {
  try {
    const booking = await RealTimeBooking.findById(req.params.id)
      .populate('offers.vendorId', 'firstName lastName pharmacyName profilePic location averageRating totalRatings');
      
    if (!booking) return res.status(404).json(errorResponse("Order not found"));
    
    // Generate signed urls for offers
    for (const offer of booking.offers) {
      if (offer.vendorId && offer.vendorId.profilePic) {
        offer.vendorId.profilePicSigned = await s3Service.getSignedUrl(offer.vendorId.profilePic);
      }
    }
    
    res.status(200).json(successResponse("Offers retrieved", { offers: booking.offers }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch offers"));
  }
};

const approvePrescriptionOffer = async (req, res, next) => {
  try {
    const { offerId, vendorId } = req.body;
    
    const booking = await RealTimeBooking.findById(req.params.id);
    if (!booking) return res.status(404).json(errorResponse("Order not found"));
    
    // Find the accepted offer
    const acceptedOffer = booking.offers.find(o => 
      (offerId && o._id.toString() === offerId) || 
      (vendorId && o.vendorId.toString() === vendorId)
    );
    
    if (!acceptedOffer) {
      return res.status(400).json(errorResponse("Offer not found"));
    }

    // Update statuses
    booking.offers.forEach(o => {
      o.status = (o._id.toString() === acceptedOffer._id.toString()) ? 'accepted' : 'rejected';
    });
    
    booking.status = 'accepted';
    booking.acceptedProvider = acceptedOffer.vendorId;
    booking.price = acceptedOffer.amount;
    booking.notes = (booking.notes ? booking.notes + " | " : "") + "Expected Delivery: " + acceptedOffer.deliveryTime;
    
    await booking.save();
    
    // Notify vendor
    await notificationService.send({
      recipient: acceptedOffer.vendorId,
      sender: req.user.userId,
      type: "booking_update",
      title: "Prescription Order Accepted",
      message: "The patient has approved your offer for the prescription order.",
      data: { bookingId: booking._id },
      sendPush: true,
    });
    
    // Emit socket event to vendor
    const { getSocketHandler } = await import('../socket/socket.handler.js');
    const socketHandler = getSocketHandler();
    socketHandler.emitToUser(acceptedOffer.vendorId.toString(), "booking:status_update", {
      bookingId: booking._id,
      status: "accepted"
    });

    res.status(200).json(successResponse("Offer approved successfully", { booking }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to approve offer"));
  }
};

export {
  getNearbyServices,
  createBooking,
  getBookings,
  getActiveBookings,
  getBookingDetails,
  cancelBooking,
  addRating,
  triggerEmergency,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  // Search functions
  searchDoctors,
  searchNurses,
  searchAmbulances,
  searchMedicines,
  searchPharmacies,
  searchPathologyLabs,
  searchBloodBanks,
  globalSearch,
  // Detail functions
  getNurseDetails,
  getAmbulanceDetails,
  getNurseAvailability,
  getMedicineById,
  getDoctorById,
  createPrescriptionOrder,
  getPrescriptionOffers,
  approvePrescriptionOffer,
};
