import { Booking } from '../models/Booking.model.js';
import { User } from '../models/User.model.js';
import { Doctor } from '../models/Doctor.model.js';
import { notificationService } from './notification.service.js';
import { paymentService } from './payment.service.js';
import { logger } from '../utils/logger.util.js';

const DAYS_OF_WEEK = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const validateDoctorAvailability = async (doctorId, scheduledTime, timeSlot) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  // If doctor has no availability set, allow booking (will use default slots in frontend)
  if (!doctor.availability || doctor.availability.length === 0) {
    logger.info('Doctor has no availability schedule set, allowing booking with default slots', {
      doctorId,
      scheduledTime,
    });
    return; // Allow booking
  }

  const scheduledDate = new Date(scheduledTime);
  const dayOfWeek = DAYS_OF_WEEK[scheduledDate.getDay()];

  const dayAvailability = doctor.availability.find(a => a.day === dayOfWeek);
  
  // If no availability for this specific day, allow booking
  if (!dayAvailability || dayAvailability.slots.length === 0) {
    logger.info(`Doctor has no availability set for ${dayOfWeek}, allowing booking`, {
      doctorId,
      dayOfWeek,
    });
    return; // Allow booking
  }

  // If timeSlot is provided, validate it
  if (timeSlot && timeSlot.start && timeSlot.end) {
    const matchingSlot = dayAvailability.slots.find(
      s => s.isAvailable !== false && timeSlot.start >= s.startTime && timeSlot.end <= s.endTime
    );

    if (!matchingSlot) {
      throw new Error(`Requested time slot ${timeSlot.start}-${timeSlot.end} is not available on ${dayOfWeek}`);
    }
  } else {
    // Check if there's at least one available slot
    const hasAvailableSlot = dayAvailability.slots.some(s => s.isAvailable !== false);
    if (!hasAvailableSlot) {
      throw new Error(`No available slots on ${dayOfWeek}`);
    }
  }
};


const createBooking = async (bookingData) => {
  console.log('\n\n🚨🚨🚨 CREATE BOOKING SERVICE CALLED 🚨🚨🚨\n\n');
  
  try {
    console.log('🔴 SERVICE ENTRY - bookingData:', JSON.stringify(bookingData, null, 2));
    console.log('🔴 bloodGroup at entry:', bookingData.bloodGroup);
    console.log('🔴 unitsRequired at entry:', bookingData.unitsRequired);
    
    // CRITICAL DEBUG: Log incoming data FIRST
    logger.info('=== CREATE BOOKING CALLED ===');
    logger.info('Service Type:', bookingData.serviceType);
    logger.info('Full bookingData keys:', Object.keys(bookingData));
    logger.info('Full bookingData:', JSON.stringify(bookingData, null, 2));
    
    // Validate doctor availability if needed
    if (bookingData.serviceType === 'doctor' && bookingData.scheduledTime) {
      await validateDoctorAvailability(
        bookingData.provider,
        bookingData.scheduledTime,
        bookingData.timeSlot
      );
    }

    // Validate consultation type for doctor bookings
    if (bookingData.serviceType === 'doctor' && bookingData.provider) {
      const doctor = await Doctor.findById(bookingData.provider);
      if (doctor && doctor.consultationTypes && doctor.consultationTypes.length > 0) {
        const requestedType = bookingData.consultationType || 'in-person';
        
        if (!doctor.consultationTypes.includes(requestedType)) {
          // If doctor only supports video-call and user requested in-person, auto-convert
          if (doctor.consultationTypes.length === 1 && doctor.consultationTypes[0] === 'video-call' && requestedType === 'in-person') {
            logger.info(`Auto-converting booking to video-call for video-only doctor: ${doctor.firstName} ${doctor.lastName}`);
            bookingData.consultationType = 'video-call';
            // Remove location for video calls
            delete bookingData.location;
          } else {
            throw new Error(`Doctor does not support ${requestedType} consultations. Available types: ${doctor.consultationTypes.join(', ')}`);
          }
        } else {
          // Set the validated consultation type
          bookingData.consultationType = requestedType;
        }
      } else {
        // If doctor has no consultation types set, default to in-person
        bookingData.consultationType = bookingData.consultationType || 'in-person';
      }
    }

    // Validate blood bank bookings
    if (bookingData.serviceType === 'bloodbank' && bookingData.provider) {
      console.log('=== SERVICE: BLOOD BANK BOOKING ===');
      console.log('bloodGroup:', bookingData.bloodGroup);
      console.log('unitsRequired:', bookingData.unitsRequired);
      console.log('price:', bookingData.price);
      
      const { BloodBank } = await import('../models/BloodBank.model.js');
      const bloodBank = await BloodBank.findById(bookingData.provider);
      
      if (!bloodBank) {
        throw new Error('Blood bank not found');
      }
      
      logger.info('Blood bank found:', bloodBank.bankName || bloodBank.firstName);
      
      // Validate stock availability
      const stockItem = bloodBank.bloodStock.find(
        stock => stock.bloodGroup === bookingData.bloodGroup
      );
      
      if (!stockItem) {
        throw new Error(`Blood group ${bookingData.bloodGroup} not available at this blood bank`);
      }
      
      if (stockItem.unitsAvailable < bookingData.unitsRequired) {
        throw new Error(`Only ${stockItem.unitsAvailable} units of ${bookingData.bloodGroup} available`);
      }
      
      // CRITICAL: Validate price matches blood bank pricing
      const expectedPrice = stockItem.pricePerUnit * bookingData.unitsRequired;
      const sentPrice = bookingData.price;
      
      logger.info(`Price validation - Expected: ₹${expectedPrice}, Sent: ₹${sentPrice}`);
      
      // Allow small tolerance for rounding (±1 rupee)
      const priceDifference = Math.abs(expectedPrice - sentPrice);
      if (priceDifference > 1) {
        throw new Error(
          `Price mismatch! Expected ₹${expectedPrice} (₹${stockItem.pricePerUnit} × ${bookingData.unitsRequired} units) but received ₹${sentPrice}`
        );
      }
      
      // Use the blood bank's actual price to prevent manipulation
      bookingData.price = expectedPrice;
      
      logger.info(`Blood bank booking validated - Corrected Price: ₹${expectedPrice}`);
    }

    // Normalize location format for booking storage
    if (bookingData.location?.type === 'Point' && bookingData.location?.coordinates) {
      // Convert GeoJSON format to booking format
      const [longitude, latitude] = bookingData.location.coordinates;
      bookingData.location = {
        address: bookingData.address || 'Location not specified',
        coordinates: [longitude, latitude]
      };
    }

    // Set default consultation type ONLY for doctor bookings if not already set
    if (bookingData.serviceType === 'doctor' && !bookingData.consultationType) {
      bookingData.consultationType = 'in-person'; // Use lowercase with hyphen
    }

    const booking = new Booking(bookingData);
    await booking.save();

    // Populate the booking with provider and patient details
    await booking.populate('provider patient');

    // Send notification (don't let notification errors break booking creation)
    try {
      await notificationService.sendBookingConfirmation(
        booking.patient._id,
        { serviceType: booking.serviceType, id: booking._id }
      );

      // If it's a medicine/pharmacist order, notify all pharmacists
      if (booking.serviceType === 'pharmacist' || booking.serviceType === 'pharmacy') {
        const orderDetails = {
          itemCount: booking.items?.length || 1,
          totalAmount: booking.price || 0,
          patientName: booking.patient.firstName + ' ' + booking.patient.lastName,
        };
        await notificationService.sendMedicineOrderToAllPharmacists(
          booking._id.toString(),
          orderDetails
        );
      }
    } catch (notificationError) {
      logger.error('Failed to send booking confirmation notification', {
        error: notificationError.message,
        bookingId: booking._id
      });
      // Continue without failing the booking creation
    }

    logger.info(`Booking created: ${booking._id}`);
    return booking;
  } catch (error) {
    logger.error('Create booking failed', { error: error.message });
    throw error;
  }
};


const getBooking = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId)
      .populate('provider', 'firstName lastName phone specialization')
      .populate('patient', 'firstName lastName phone')
      .populate('prescription')
      .lean();

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.provider) {
      booking.doctorName = `${booking.provider.firstName} ${booking.provider.lastName}`;
      booking.doctorPhone = booking.provider.phone;
    }

    return booking;
  } catch (error) {
    logger.error('Get booking failed', { error: error.message });
    throw error;
  }
};


const getUserBookings = async (userId, role, query = {}) => {
  try {
    const { page = 1, limit = 10, status, serviceType } = query;

    const filter = role === 'patient'
      ? { patient: userId }
      : { provider: userId };

    // Only add status filter if it's not 'all'
    if (status && status !== 'all') filter.status = status;
    
    // Only add serviceType filter if it's not 'all'
    if (serviceType && serviceType !== 'all') filter.serviceType = serviceType;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('provider patient prescription')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(filter),
    ]);

    // Format patient names in bookings list
    const formattedBookings = bookings.map(booking => {
      if (booking.patient) {
        booking.patient.fullName = `${booking.patient.firstName || ''} ${booking.patient.lastName || ''}`.trim();
      }
      return booking;
    });

    return {
      bookings: formattedBookings,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Get user bookings failed', { error: error.message });
    throw error;
  }
};


const getActiveBookings = async (userId, role = 'patient') => {
  try {
    const filter = role === 'patient'
      ? { patient: userId }
      : { provider: userId };

    filter.status = {
      $in: ['requested', 'accepted', 'on_the_way', 'in_progress']
    };

    const bookings = await Booking.find(filter)
      .populate('provider patient')
      .sort({ createdAt: -1 })
      .lean();

    return bookings;
  } catch (error) {
    logger.error('Get active bookings failed', { error: error.message });
    throw error;
  }
};

/**
 * Accept booking with atomic operation to prevent race conditions
 * FIXED: Use findOneAndUpdate with atomic status check to prevent double acceptance
 * For medicine orders: First pharmacist to accept gets the order
 */
const acceptBooking = async (bookingId, providerId) => {
  try {
    // Check provider availability first
    const provider = await User.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.status !== 'approved' && provider.status !== 'active') {
      throw new Error('Provider account not approved');
    }

    // Check role-specific availability
    if (provider.role === 'ambulance' && !provider.isAvailable) {
      throw new Error('Ambulance not available');
    }

    if (provider.role === 'doctor') {
      // Check if doctor has conflicting bookings
      const conflictingBooking = await Booking.findOne({
        provider: providerId,
        status: { $in: ['accepted', 'in_progress'] },
        scheduledTime: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 60 * 60 * 1000), // Next hour
        },
      });

      if (conflictingBooking) {
        throw new Error('Provider has conflicting booking at this time');
      }
    }

    // FIXED: Use atomic findOneAndUpdate to prevent race condition
    // For medicine orders without provider, first pharmacist to accept gets it
    // For other bookings, only assigned provider can accept
    const updateQuery = {
      _id: bookingId,
      status: 'requested', // Atomic check - only update if still in requested state
    };

    // If it's a medicine order without provider, any pharmacist can accept
    // Otherwise, only the assigned provider can accept
    const booking = await Booking.findOne({ _id: bookingId });
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.provider) {
      // If provider is already assigned, only that provider can accept
      if (booking.provider.toString() !== providerId) {
        throw new Error('This booking is not assigned to you');
      }
      updateQuery.provider = providerId;
    } else {
      // For medicine orders without provider, check if user is pharmacist
      if (provider.role !== 'pharmacist') {
        throw new Error('Only pharmacists can accept medicine orders');
      }
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      updateQuery,
      {
        $set: {
          provider: providerId, // Assign provider for medicine orders
          status: 'accepted',
          acceptedAt: new Date(),
        }
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('provider patient');

    if (!updatedBooking) {
      throw new Error('Booking not found, already accepted by another provider, or not available');
    }

    // Send notification after successful acceptance
    try {
      await notificationService.sendBookingAccepted(
        updatedBooking.patient._id,
        updatedBooking.provider._id,
        { id: updatedBooking._id }
      );
    } catch (notificationError) {
      logger.error('Notification failed after booking acceptance', {
        error: notificationError.message,
        bookingId,
      });
      // Don't fail the acceptance if notification fails
    }

    logger.info(`Booking accepted: ${bookingId} by provider ${providerId}`);
    return updatedBooking;
  } catch (error) {
    logger.error('Accept booking failed', { error: error.message, bookingId, providerId });
    throw error;
  }
};

const cancelBooking = async (bookingId, userId, reason) => {
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ patient: userId }, { provider: userId }],
      status: { $in: ['requested', 'accepted'] },
    });

    if (!booking) {
      throw new Error('Booking not found or cannot be cancelled');
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancelledBy = userId;
    await booking.save();
    await booking.populate('provider patient');

    
    const notifyUserId = booking.patient._id.toString() === userId
      ? booking.provider._id
      : booking.patient._id;

    await notificationService.sendBookingCancelled(
      notifyUserId,
      booking._id.toString(),
      reason
    );

    logger.info(`Booking cancelled: ${bookingId}`);
    return booking;
  } catch (error) {
    logger.error('Cancel booking failed', { error: error.message });
    throw error;
  }
};


const updateBookingStatus = async (bookingId, providerId, status, additionalData = {}) => {
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      provider: providerId,
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const validTransitions = {
      'requested': ['accepted', 'cancelled'],
      'accepted': ['on_the_way', 'in_progress', 'cancelled'],
      'on_the_way': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      throw new Error(`Cannot transition from ${booking.status} to ${status}`);
    }

    booking.status = status;

    if (status === 'in_progress' && !booking.startTime) {
      booking.startTime = new Date();
    }

    if (status === 'completed' && !booking.endTime) {
      booking.endTime = new Date();
    }


    Object.assign(booking, additionalData);

    await booking.save();
    await booking.populate('provider patient');


    switch (status) {
      case 'on_the_way':
        await notificationService.sendProviderArriving(
          booking.patient._id,
          booking.provider._id,
          15
        );
        break;
      case 'in_progress':

        break;
      case 'completed':
        await notificationService.sendBookingCompleted(
          booking.patient._id,
          booking._id.toString()
        );
        
        // Auto-release payment to vendor if payment is received
        if (booking.paymentStatus === 'paid') {
          try {
            await paymentService.releasePaymentToVendor(booking._id);
            logger.info(`Auto-released payout for booking: ${bookingId}`);
          } catch (payoutError) {
            logger.error('Auto-release payout failed', {
              error: payoutError.message,
              bookingId,
            });
            // Don't fail the status update if payout fails
          }
        }
        break;
    }

    logger.info(`Booking status updated: ${bookingId} -> ${status}`);
    return booking;
  } catch (error) {
    logger.error('Update booking status failed', { error: error.message });
    throw error;
  }
};


const updateETA = async (bookingId, providerId, estimatedArrival) => {
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      provider: providerId,
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    booking.estimatedArrival = estimatedArrival || new Date(Date.now() + 10 * 60000);
    await booking.save();

    logger.info(`ETA updated for booking: ${bookingId}`);
    return booking;
  } catch (error) {
    logger.error('Update ETA failed', { error: error.message });
    throw error;
  }
};


const addRating = async (bookingId, patientId, rating, review) => {
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      patient: patientId,
      status: 'completed',
    }).populate('provider');

    if (!booking) {
      throw new Error('Booking not found or not completed');
    }


    const provider = await User.findById(booking.provider._id);

    if (provider.rating) {
      const totalRatings = (provider.rating.average * provider.rating.count) + rating;
      provider.rating.count += 1;
      provider.rating.average = totalRatings / provider.rating.count;
    } else {
      provider.rating = {
        average: rating,
        count: 1,
      };
    }

    provider.reviews = provider.reviews || [];
    provider.reviews.push({
      booking: bookingId,
      patient: patientId,
      rating,
      review,
      createdAt: new Date(),
    });

    await provider.save();

    logger.info(`Rating added for booking: ${bookingId}`);
    return { booking, provider };
  } catch (error) {
    logger.error('Add rating failed', { error: error.message });
    throw error;
  }
};


const getBookingStats = async (providerId) => {
  try {
    const [total, completed, cancelled, active] = await Promise.all([
      Booking.countDocuments({ provider: providerId }),
      Booking.countDocuments({ provider: providerId, status: 'completed' }),
      Booking.countDocuments({ provider: providerId, status: 'cancelled' }),
      Booking.countDocuments({
        provider: providerId,
        status: { $in: ['requested', 'accepted', 'on_the_way', 'in_progress'] }
      }),
    ]);

    return {
      total,
      completed,
      cancelled,
      active,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
    };
  } catch (error) {
    logger.error('Get booking stats failed', { error: error.message });
    throw error;
  }
};

// export const bookingService = {
//   createBooking,
//   getBooking,
//   getUserBookings,
//   getActiveBookings,
//   acceptBooking,
//   cancelBooking,
//   updateBookingStatus,
//   updateETA,
//   addRating,
//   getBookingStats,
// };


/**
 * Add documents to existing booking
 */
const addDocumentsToBooking = async (bookingId, documents) => {
  try {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Initialize patientDocuments if not exists
    if (!booking.patientDocuments) {
      booking.patientDocuments = {
        medicalReports: [],
        previousPrescriptions: [],
        otherDocuments: [],
      };
    }

    // Add new documents to existing arrays
    if (documents.medicalReports && documents.medicalReports.length > 0) {
      booking.patientDocuments.medicalReports.push(...documents.medicalReports);
    }

    if (documents.previousPrescriptions && documents.previousPrescriptions.length > 0) {
      booking.patientDocuments.previousPrescriptions.push(...documents.previousPrescriptions);
    }

    if (documents.otherDocuments && documents.otherDocuments.length > 0) {
      booking.patientDocuments.otherDocuments.push(...documents.otherDocuments);
    }

    await booking.save();
    await booking.populate('patient provider');

    logger.info(`Documents added to booking ${bookingId}`);
    return booking;
  } catch (error) {
    logger.error('Add documents to booking failed', { error: error.message, bookingId });
    throw error;
  }
};

/**
 * Remove document from booking
 */
const removeDocumentFromBooking = async (bookingId, documentType, documentId) => {
  try {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (!booking.patientDocuments || !booking.patientDocuments[documentType]) {
      throw new Error('Document type not found');
    }

    // Remove document from array
    booking.patientDocuments[documentType] = booking.patientDocuments[documentType].filter(
      doc => doc._id.toString() !== documentId
    );

    await booking.save();
    await booking.populate('patient provider');

    logger.info(`Document removed from booking ${bookingId}`, { documentType, documentId });
    return booking;
  } catch (error) {
    logger.error('Remove document from booking failed', { error: error.message, bookingId });
    throw error;
  }
};

const completeBooking = async (bookingId, providerId) => {
  try {
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      const error = new Error('Booking not found');
      error.statusCode = 404;
      throw error;
    }

    // Verify provider authorization
    if (booking.provider.toString() !== providerId) {
      const error = new Error('Not authorized to complete this booking');
      error.statusCode = 403;
      throw error;
    }

    // Check if booking can be completed
    if (!['accepted', 'in_progress'].includes(booking.status)) {
      const error = new Error(`Cannot complete booking with status: ${booking.status}`);
      error.statusCode = 400;
      throw error;
    }

    // Update booking to completed
    const now = new Date();
    booking.status = 'completed';
    booking.endTime = now;
    
    // Calculate duration if startTime exists
    if (booking.startTime) {
      booking.duration = Math.round((now - booking.startTime) / (1000 * 60)); // minutes
    }

    await booking.save();

    logger.info(`Booking ${bookingId} completed by provider ${providerId}`, {
      bookingId,
      providerId,
      endTime: booking.endTime,
      duration: booking.duration,
    });

    return booking;
  } catch (error) {
    logger.error('Complete booking error', { 
      error: error.message, 
      bookingId, 
      providerId 
    });
    throw error;
  }
};

export const bookingService = {
  createBooking,
  getBooking,
  getUserBookings,
  getActiveBookings,
  acceptBooking,
  cancelBooking,
  updateBookingStatus,
  updateETA,
  addRating,
  getBookingStats,
  addDocumentsToBooking,
  removeDocumentFromBooking,
  completeBooking,
};
