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
};

const createRealTimeBooking = async (bookingData) => {
  try {
    const booking = new RealTimeBooking(bookingData);
    await booking.save();
    await booking.populate("patient");

    // Find nearby available providers
    const providers = await findAvailableProviders(
      booking.serviceType,
      booking.location.coordinates,
      booking.isEmergency
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
      title: "Booking Request Sent",
      message: `Your ${booking.serviceType} booking request has been sent to ${providers.length} nearby providers.`,
      data: { bookingId: booking._id, providerCount: providers.length },
      sendPush: true,
    });

    logger.info(`Real-time booking created: ${booking._id}, notified ${providers.length} providers`);
    return booking;
  } catch (error) {
    logger.error("Create real-time booking failed", { error: error.message });
    throw error;
  }
};

const findAvailableProviders = async (serviceType, coordinates, isEmergency) => {
  try {
    const role = SERVICE_TYPE_TO_ROLE[serviceType];
    if (!role) {
      throw new Error(`Invalid service type: ${serviceType}`);
    }

    const maxDistance = isEmergency ? 20000 : 10000; // 20km for emergency, 10km for normal
    const [longitude, latitude] = coordinates;

    const query = {
      role,
      status: "approved",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance,
        },
      },
    };

    // Add role-specific availability filters
    if (role === "ambulance") {
      query.isAvailable = true;
    }

    const providers = await User.find(query)
      .select("_id firstName lastName phone email deviceTokens location")
      .limit(50)
      .lean();

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

      // Send real-time socket notification
      socketHandler.emitToUser(provider._id.toString(), "new:booking:request", {
        bookingId: booking._id,
        serviceType: booking.serviceType,
        patientName: `${booking.patient.firstName} ${booking.patient.lastName}`,
        location: booking.location,
        requirements: booking.requirements,
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
        message: `${booking.patient.firstName} needs ${booking.serviceType} service. ${booking.requirements.description.substring(0, 100)}`,
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
        status: "pending", // Only accept if still pending
        acceptedProvider: null, // Only if no provider has accepted yet
        expiresAt: { $gt: new Date() }, // Ensure booking hasn't expired
      },
      {
        $set: {
          acceptedProvider: providerId,
          status: "accepted",
          acceptedAt: new Date(),
        },
      },
      { new: true }
    ).populate("patient acceptedProvider");

    if (!booking) {
      // Booking was already accepted by another provider or doesn't exist
      const existingBooking = await RealTimeBooking.findById(bookingId);
      if (!existingBooking) {
        throw new Error("Booking not found");
      }
      if (existingBooking.acceptedProvider) {
        throw new Error("This booking has already been accepted by another provider");
      }
      if (existingBooking.expiresAt < new Date()) {
        throw new Error("This booking has expired");
      }
      throw new Error("Unable to accept booking");
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
      accepted: ["on_the_way", "cancelled"],
      on_the_way: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
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
      on_the_way: "Your provider is on the way!",
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
      .populate("acceptedProvider", "firstName lastName phone email specialization")
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
    const query = {
      $or: [
        { acceptedProvider: providerId },
        { "notifiedProviders.provider": providerId, status: "pending" },
      ],
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
        status: "pending",
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
};
