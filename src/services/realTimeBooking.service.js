import { RealTimeBooking } from "../models/RealTimeBooking.model.js";
import { User } from "../models/User.model.js";
import { locationService } from "./location.service.js";
import { notificationService } from "./notification.service.js";
import { logger } from "../utils/logger.util.js";
import { getSocketHandler } from "../socket/socket.handler.js";

const SERVICE_TYPE_TO_ROLE = {
  doctor: "doctor",
  nurse: "nurse",
  ambulance: "ambulance",
  pharmacist: "pharmacist",
  bloodbank: "bloodbank",
  pathology: "pathology",
  labtest: "pathology",
};

const createRealTimeBooking = async (bookingData) => {
  try {
    const booking = new RealTimeBooking(bookingData);
    await booking.save();
    await booking.populate("patient");

    if (booking.status !== "in_cart") {
      // Find available providers by city (or fallback to geo for doctor)
      const providers = await findAvailableProviders(
        booking.serviceType,
        booking.location.coordinates,
        booking.isEmergency,
        booking.category,
        booking.city,
        booking.state
      );

      if (providers.length === 0) {
        logger.warn(`No providers found for booking ${booking._id}`);
        // Still create the booking, but notify patient
        await notificationService.send({
          recipient: booking.patient._id,
          type: "booking_confirmation",
          title: "Booking Created",
          message: "We're searching for available providers. You'll be notified once someone accepts.",
          data: { bookingId: booking._id },
          sendPush: true,
        });
        return booking;
      }

      // Notify all providers via multiple channels
      await notifyAllProviders(booking, providers);

      // Send confirmation to patient
      await notificationService.send({
        recipient: booking.patient._id,
        type: "booking_confirmation",
        title: "Booking Created",
        message: "Your booking has been created and sent to nearby providers.",
        data: { bookingId: booking._id },
        sendPush: true,
      });
    }

    return booking;

    logger.info(`Real-time booking created: ${booking._id}, notified ${providers.length} providers`);
    return booking;
  } catch (error) {
    logger.error("Create real-time booking failed", { error: error.message });
    throw error;
  }
};

const findAvailableProviders = async (serviceType, coordinates, isEmergency, category, city, state) => {
  try {
    const role = SERVICE_TYPE_TO_ROLE[serviceType];
    if (!role) {
      throw new Error(`Invalid service type: ${serviceType}`);
    }

    let limit = 50;
    if (role === 'ambulance') limit = 20;

    const rolesToSearch = [role];
    // Pathology bookings also notify bloodbanks
    if (role === 'pathology') {
      rolesToSearch.push('bloodbank');
    }

    const query = {
      role: { $in: rolesToSearch },
      status: "approved",
    };

    if (role === 'doctor') {
      // Doctor: no geo/city filter — search all approved doctors
      if (category) {
        query.category = category;
      }
    } else {
      // All non-doctor services: match by city (case-insensitive)
      if (city && city.trim() !== '') {
        query.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
      } else {
        // Fallback: if no city provided, use geo-radius (20km)
        const [longitude, latitude] = coordinates;
        if (longitude !== 0 || latitude !== 0) {
          query.location = {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              $maxDistance: 20000,
            },
          };
        }
      }
    }

    // Ambulance: must be marked as available
    if (role === "ambulance") {
      query.isAvailable = true;
    }

    logger.info(`Finding providers: role=${role}, city=${city || 'N/A'}, state=${state || 'N/A'}`);

    const providers = await User.find(query)
      .select("_id firstName lastName phone email deviceTokens location city state")
      .limit(limit)
      .lean();

    logger.info(`Found ${providers.length} providers for ${serviceType} in city: ${city || 'N/A'}`);
    return providers;
  } catch (error) {
    logger.error("Find available providers failed", { error: error.message });
    throw error;
  }
};

const notifyAllProviders = async (booking, providers) => {
  try {
    const socketHandler = getSocketHandler();
    const notifiedProviders = [];

    for (const provider of providers) {
      // Add to notifiedProviders array
      notifiedProviders.push({
        provider: provider._id,
        notifiedAt: new Date(),
        viewed: false,
      });

      const displayName = booking.patientName || `${booking.patient.firstName} ${booking.patient.lastName}`;

      // Send real-time socket notification
      socketHandler.emitToUser(provider._id.toString(), "new:booking:request", {
        bookingId: booking._id,
        serviceType: booking.serviceType,
        patientName: displayName,
        location: booking.location,
        requirements: booking.requirements,
        nursingCares: booking.nursingCares,
        isEmergency: booking.isEmergency,
        createdAt: booking.createdAt,
        expiresAt: booking.expiresAt,
      });

      // Send push notification
      await notificationService.send({
        recipient: provider._id,
        sender: booking.patient._id,
        type: "booking_request",
        title: booking.isEmergency ? "🚨 EMERGENCY Booking Request" : "New Booking Request",
        message: `${displayName} needs ${booking.serviceType} service. ${booking.requirements.description.substring(0, 100)}`,
        data: { 
          bookingId: booking._id,
          bookingType: "realtime",
          isEmergency: booking.isEmergency,
        },
        sendPush: true,
        sendSMS: booking.isEmergency, // Send SMS only for emergencies
      });
    }

    // Update booking with notified providers
    await RealTimeBooking.findByIdAndUpdate(booking._id, {
      $set: { notifiedProviders },
    });

    // Send service-specific bulk notifications
    try {
      if (booking.serviceType === 'nurse') {
        const cares = booking.nursingCares?.map(c => c.name).join(', ') || booking.requirements.specialRequirements || 'Home nursing care';
        await notificationService.sendNurseRequestToAllNurses(booking._id.toString(), {
          serviceType: cares,
          duration: booking.duration || 1,
          totalAmount: booking.totalAmount || 500,
          patientName: booking.patientName || `${booking.patient.firstName} ${booking.patient.lastName}`,
        });
      } else if (booking.serviceType === 'pathology') {
        await notificationService.sendLabTestRequestToAllLabs(booking._id.toString(), {
          testCount: booking.tests?.length || 1,
          totalAmount: booking.totalAmount || 500,
          patientName: `${booking.patient.firstName} ${booking.patient.lastName}`,
          tests: booking.tests || [],
        });
      } else if (booking.serviceType === 'pharmacist') {
        await notificationService.sendMedicineOrderToAllPharmacists(booking._id.toString(), {
          itemCount: booking.medicines?.length || 1,
          totalAmount: booking.totalAmount || booking.price || 0,
          patientName: `${booking.patient.firstName} ${booking.patient.lastName}`,
        });
      }
    } catch (bulkNotificationError) {
      logger.error('Failed to send bulk notifications', { 
        error: bulkNotificationError.message,
        serviceType: booking.serviceType,
        bookingId: booking._id,
      });
      // Don't throw - bulk notification failure shouldn't break the main flow
    }

    logger.info(`Notified ${providers.length} providers for booking ${booking._id}`);
  } catch (error) {
    logger.error("Notify providers failed", { error: error.message });
    // Don't throw - notification failure shouldn't break booking creation
  }
};

const acceptBooking = async (bookingId, providerId) => {
  try {
    // Validate provider availability before accepting
    const provider = await User.findById(providerId).select("role status");
    if (!provider) {
      throw new Error("Provider not found");
    }
    if (provider.status !== "approved") {
      throw new Error("Provider account is not approved");
    }

    // Use findOneAndUpdate with atomic operation to prevent race conditions
    const booking = await RealTimeBooking.findOneAndUpdate(
      {
        _id: bookingId,
        status: { $in: ["pending", "requested"] }, // Accept both pending and requested
        acceptedProvider: null, // Only if no provider has accepted yet
        $or: [
          { expiresAt: { $exists: false } }, // Orders without expiration
          { expiresAt: { $gt: new Date() } }, // Ensure booking hasn't expired
        ],
      },
      {
        $set: {
          acceptedProvider: providerId,
          status: "accepted",
          acceptedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    ).populate("patient acceptedProvider");

    if (!booking) {
      // Booking was already accepted by another provider or doesn't exist
      const existingBooking = await RealTimeBooking.findById(bookingId);
      if (!existingBooking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
      }
      if (existingBooking.acceptedProvider) {
        const error = new Error("Order expired or already accepted by another provider");
        error.status = 409;
        throw error;
      }
      const error = new Error("Order expired");
      error.status = 410;
      throw error;
    }

    const socketHandler = getSocketHandler();

    // Notify patient that booking was accepted (SMS + App Notification)
    await notificationService.send({
      recipient: booking.patient._id,
      sender: providerId,
      type: "booking_accepted",
      title: "Booking Accepted!",
      message: `${booking.acceptedProvider.firstName} ${booking.acceptedProvider.lastName} has accepted your booking request.`,
      data: { 
        bookingId: booking._id,
        providerId: providerId,
        providerName: `${booking.acceptedProvider.firstName} ${booking.acceptedProvider.lastName}`,
        providerPhone: booking.acceptedProvider.phone,
      },
      sendPush: true,
      sendSMS: true, // Send SMS when booking is accepted
    });

    // Emit socket event to patient
    socketHandler.emitToUser(booking.patient._id.toString(), "booking:accepted", {
      bookingId: booking._id,
      provider: {
        id: booking.acceptedProvider._id,
        name: `${booking.acceptedProvider.firstName} ${booking.acceptedProvider.lastName}`,
        phone: booking.acceptedProvider.phone,
      },
    });

    // Notify all other providers that booking is no longer available
    const otherProviders = booking.notifiedProviders
      .filter(np => np.provider.toString() !== providerId.toString())
      .map(np => np.provider);

    for (const otherProviderId of otherProviders) {
      socketHandler.emitToUser(otherProviderId.toString(), "booking:no:longer:available", {
        bookingId: booking._id,
        message: "This booking has been accepted by another provider",
      });
    }

    logger.info(`Booking ${bookingId} accepted by provider ${providerId}`);
    return booking;
  } catch (error) {
    logger.error("Accept booking failed", { error: error.message });
    throw error;
  }
};

const updateBookingStatus = async (bookingId, providerId, newStatus) => {
  try {
    const booking = await RealTimeBooking.findOne({
      _id: bookingId,
      acceptedProvider: providerId,
    });

    if (!booking) {
      throw new Error("Booking not found or you are not the assigned provider");
    }

    // Validate status transitions
    const validTransitions = {
      accepted: ["preparing", "ready", "on_the_way", "in_progress", "packing_medicines", "out_for_delivery", "sample_collected", "completed", "cancelled"],
      preparing: ["ready", "on_the_way", "in_progress", "completed", "cancelled"],
      packing_medicines: ["out_for_delivery", "on_the_way", "completed", "cancelled"],
      ready: ["on_the_way", "in_progress", "completed", "cancelled"],
      on_the_way: ["reached", "in_progress", "sample_collected", "completed", "cancelled"],
      out_for_delivery: ["completed", "cancelled"],
      reached: ["in_progress", "sample_collected", "completed", "cancelled"],
      in_progress: ["on_the_way", "out_for_delivery", "sample_collected", "completed", "cancelled"],
      sample_collected: ["report_uploaded", "completed", "cancelled"],
      report_uploaded: ["completed", "cancelled"],
    };

    if (!validTransitions[booking.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${booking.status} to ${newStatus}`);
    }

    booking.status = newStatus;

    if (newStatus === "on_the_way") {
      booking.startTime = new Date();
    } else if (newStatus === "completed") {
      booking.endTime = new Date();
      
      // Deduct stock for medicine orders
      if (booking.serviceType === 'pharmacist' && booking.medicines && booking.medicines.length > 0) {
        const { Medicine } = await import('../models/Medicine.model.js');
        
        for (const item of booking.medicines) {
          await Medicine.findByIdAndUpdate(
            item.medicineId,
            { $inc: { stock: -item.quantity } },
            { new: true }
          );
        }
        
        logger.info(`Stock deducted for booking ${bookingId}`, {
          medicines: booking.medicines.map(m => ({ id: m.medicineId, quantity: m.quantity }))
        });
      }
    }

    await booking.save();
    await booking.populate("patient acceptedProvider");

    const socketHandler = getSocketHandler();

    // Notify patient of status change
    const statusMessages = {
      preparing: "Your provider is preparing your order/service",
      ready: "Your order/service is ready",
      on_the_way: "Your provider is on the way!",
      reached: "Your provider has reached the location",
      in_progress: "Service has started",
      completed: "Service completed successfully",
      cancelled: "Booking has been cancelled",
    };

    await notificationService.send({
      recipient: booking.patient._id,
      sender: providerId,
      type: "booking_update",
      title: "Booking Status Updated",
      message: statusMessages[newStatus],
      data: { bookingId: booking._id, status: newStatus },
      sendPush: true,
    });

    socketHandler.emitToUser(booking.patient._id.toString(), "booking:status:updated", {
      bookingId: booking._id,
      status: newStatus,
      timestamp: new Date(),
    });

    logger.info(`Booking ${bookingId} status updated to ${newStatus}`);
    return booking;
  } catch (error) {
    logger.error("Update booking status failed", { error: error.message });
    throw error;
  }
};

const cancelBooking = async (bookingId, userId, reason) => {
  try {
    const booking = await RealTimeBooking.findById(bookingId).populate("patient acceptedProvider");

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if user is authorized to cancel
    const isPatient = booking.patient._id.toString() === userId.toString();
    const isProvider = booking.acceptedProvider?._id.toString() === userId.toString();

    if (!isPatient && !isProvider) {
      throw new Error("You are not authorized to cancel this booking");
    }

    // Can't cancel if already completed
    if (booking.status === "completed") {
      throw new Error("Cannot cancel a completed booking");
    }

    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.cancelledBy = userId;
    await booking.save();

    const socketHandler = getSocketHandler();

    // Notify the other party
    const recipientId = isPatient ? booking.acceptedProvider?._id : booking.patient._id;
    if (recipientId) {
      await notificationService.send({
        recipient: recipientId,
        sender: userId,
        type: "booking_update",
        title: "Booking Cancelled",
        message: `Booking has been cancelled. Reason: ${reason}`,
        data: { bookingId: booking._id },
        sendPush: true,
      });

      socketHandler.emitToUser(recipientId.toString(), "booking:cancelled", {
        bookingId: booking._id,
        reason,
        cancelledBy: isPatient ? "patient" : "provider",
      });
    } else if (isPatient && booking.notifiedProviders && booking.notifiedProviders.length > 0) {
      // If cancelled before anyone accepted, notify all notified providers
      booking.notifiedProviders.forEach(np => {
        socketHandler.emitToUser(np.provider.toString(), "booking:cancelled", {
          bookingId: booking._id,
          reason,
          cancelledBy: "patient",
        });
      });
    }

    logger.info(`Booking ${bookingId} cancelled by ${userId}`);
    return booking;
  } catch (error) {
    logger.error("Cancel booking failed", { error: error.message });
    throw error;
  }
};

const getBookingById = async (bookingId, userId) => {
  try {
    const booking = await RealTimeBooking.findById(bookingId)
      .populate("patient", "firstName lastName phone email")
      .populate("acceptedProvider", "firstName lastName phone email gender specialization experience licenseNumber labName city state pincode profilePicture role")
      .populate("offers.vendorId", "firstName lastName phone email gender specialization experience licenseNumber labName city state pincode profilePicture role averageRating totalRatings")
      .lean();

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check authorization
    const isPatient = booking.patient._id.toString() === userId.toString();
    const isProvider = booking.acceptedProvider?._id.toString() === userId.toString();
    const isNotifiedProvider = booking.notifiedProviders.some(
      np => np.provider.toString() === userId.toString()
    );

    if (!isPatient && !isProvider && !isNotifiedProvider) {
      throw new Error("You are not authorized to view this booking");
    }

    return booking;
  } catch (error) {
    logger.error("Get booking failed", { error: error.message });
    throw error;
  }
};

const getPatientBookings = async (patientId, filters = {}) => {
  try {
    const { status, page = 1, limit = 20 } = filters;
    const query = { patient: patientId };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate("acceptedProvider", "firstName lastName phone specialization")
        .populate("medicines.medicineId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

    return {
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error("Get patient bookings failed", { error: error.message });
    throw error;
  }
};

const getProviderBookings = async (providerId, filters = {}) => {
  try {
    const { status, page = 1, limit = 20 } = filters;
    
    // Get bookings where provider was notified OR accepted
    // CRITICAL: Only show "requested" bookings that are NOT expired and NOT accepted by someone else
    const query = {
      $or: [
        { acceptedProvider: providerId },
        { 
          "notifiedProviders.provider": providerId, 
          status: { $in: ["pending", "requested"] },
          acceptedProvider: null,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      ],
      // Always exclude cancelled and expired bookings from the list
      status: { $nin: ["cancelled", "expired"] },
    };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate("patient", "firstName lastName phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

    bookings.forEach(b => {
      if (b.offers && b.offers.some(o => o.vendorId && o.vendorId.toString() === providerId.toString())) {
        b.hasOffered = true;
      }
    });

    return {
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error("Get provider bookings failed", { error: error.message });
    throw error;
  }
};

const markBookingAsViewed = async (bookingId, providerId) => {
  try {
    await RealTimeBooking.updateOne(
      {
        _id: bookingId,
        "notifiedProviders.provider": providerId,
      },
      {
        $set: {
          "notifiedProviders.$.viewed": true,
          "notifiedProviders.$.viewedAt": new Date(),
        },
      }
    );
  } catch (error) {
    logger.error("Mark booking as viewed failed", { error: error.message });
  }
};

// Cleanup expired bookings (run periodically)
const expireOldBookings = async () => {
  try {
    const result = await RealTimeBooking.updateMany(
      {
        status: { $in: ["pending", "requested"] },
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Expired ${result.modifiedCount} old bookings`);
    }
  } catch (error) {
    logger.error("Expire old bookings failed", { error: error.message });
  }
};

const syncCart = async (patientId, serviceType, cartData) => {
  let booking = await RealTimeBooking.findOne({
    patient: patientId,
    serviceType,
    status: "in_cart",
  });

  if (booking) {
    booking.medicines = cartData.medicines || booking.medicines;
    booking.tests = cartData.tests || booking.tests;
    booking.price = cartData.price || booking.price;
    await booking.save();
  } else {
    booking = new RealTimeBooking({
      patient: patientId,
      serviceType,
      status: "in_cart",
      medicines: cartData.medicines,
      tests: cartData.tests,
      price: cartData.price,
      title: "Shopping Cart",
    });
    await booking.save();
  }
  return booking.populate("patient");
};

const getCart = async (patientId, serviceType) => {
  return await RealTimeBooking.findOne({
    patient: patientId,
    serviceType,
    status: "in_cart",
  }).populate("patient");
};

const checkoutCart = async (bookingId, checkoutData) => {
  const booking = await RealTimeBooking.findById(bookingId).populate("patient");
  if (!booking || booking.status !== "in_cart") {
    throw { status: 400, message: "Cart not found or already checked out" };
  }

  // Update booking with checkout data (address, payment, etc)
  Object.assign(booking, checkoutData);
  booking.status = "requested";
  await booking.save();

  // Find nearby available providers
  const providers = await findAvailableProviders(
    booking.serviceType,
    booking.location?.coordinates || [0, 0],
    booking.isEmergency,
    booking.category,
    booking.city,
    booking.state
  );

  if (providers.length > 0) {
    await notifyAllProviders(booking, providers);
  }

  return booking;
};

export const realTimeBookingService = {
  createRealTimeBooking,
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingById,
  getPatientBookings,
  getProviderBookings,
  markBookingAsViewed,
  expireOldBookings,
  syncCart,
  getCart,
  checkoutCart,
};
