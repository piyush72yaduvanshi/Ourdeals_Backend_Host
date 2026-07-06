import { realTimeBookingService } from "../services/realTimeBooking.service.js";
import { RealTimeBooking } from "../models/RealTimeBooking.model.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";

// Patient creates a real-time booking request
const createBookingRequest = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    // Support both formats: nested requirements object or flat structure
    const requirements = req.body.requirements || {};
    
    let title = req.body.title || req.body.requirements?.description || 'Service Request';
    let description = requirements.description || req.body.description || req.body.title || 'Service Request';

    if (req.body.serviceType === 'ambulance') {
      title = 'Ambulance Booking Request';
      description = `Pickup: ${req.body.address}, Drop-off: ${req.body.dropOffLocation || 'N/A'}`;
    }

    const bookingData = {
      patient: patientId,
      serviceType: req.body.serviceType,
      title: title,
      requirements: {
        description: description,
        preferredTime: requirements.preferredTime || req.body.preferredTime,
        specialRequirements: requirements.specialRequirements || req.body.specialRequirements,
      },
      location: {
        address: req.body.address || req.body.location?.address || '',
        coordinates: req.body.coordinates || req.body.location?.coordinates || [0, 0],
      },
      destination: req.body.dropOffLocation || req.body.destination,
      dropOffLocation: req.body.dropOffLocation,
      patientName: req.body.name || req.body.patientName,
      patientPhone: req.body.phone || req.body.patientPhone || req.body.contactNumber,
      patientAge: req.body.age || req.body.patientAge,
      patientGender: req.body.gender || req.body.patientGender,
      hospitalName: req.body.hospitalName,
      bloodGroup: req.body.bloodGroup,
      unitsRequired: req.body.unitsRequired,
      isEmergency: req.body.isEmergency || false,
      notes: req.body.notes,
      totalAmount: req.body.totalAmount || 0,
      city: req.body.city || '',
      state: req.body.state || '',
    };

    // Validate required fields
    if (!bookingData.serviceType) {
      return res.status(400).json(errorResponse("Service type is required"));
    }

    if (bookingData.serviceType === 'ambulance') {
      if (!bookingData.location.address) {
        return res.status(400).json(errorResponse("Pickup location is required for ambulance booking"));
      }
      if (!bookingData.dropOffLocation) {
        return res.status(400).json(errorResponse("Drop-off location is required for ambulance booking"));
      }
      if (!bookingData.patientName) {
        return res.status(400).json(errorResponse("Contact Name is required for ambulance booking"));
      }
      if (!bookingData.patientPhone) {
        return res.status(400).json(errorResponse("Phone number is required for ambulance booking"));
      }
      if (!bookingData.patientAge) {
        return res.status(400).json(errorResponse("Patient Age is required for ambulance booking"));
      }
      if (!bookingData.patientGender) {
        return res.status(400).json(errorResponse("Patient Gender is required for ambulance booking"));
      }
    }

    if (bookingData.serviceType === 'doctor') {
      if (!req.body.category) {
        return res.status(400).json(errorResponse("Category is required for doctor booking"));
      }
      bookingData.category = req.body.category;
      bookingData.patientName = req.body.name || 'Patient';
      
      if (!bookingData.requirements.description) {
        bookingData.requirements.description = `Doctor Consultation - ${bookingData.category}`;
      }
      if (!bookingData.location.address) {
        bookingData.location.address = 'Online Consultation';
      }
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

    // For lab test orders, tests array is REQUIRED
    if (bookingData.serviceType === 'labtest') {
      if (!req.body.tests || !Array.isArray(req.body.tests) || req.body.tests.length === 0) {
        return res.status(400).json(errorResponse("At least one test must be selected for lab tests."));
      }

      bookingData.tests = req.body.tests;
      bookingData.preferredDate = req.body.preferredDate;
      
      // Calculate total price based on selected tests
      bookingData.price = req.body.tests.reduce((total, test) => total + (Number(test.price) || 0), 0);
      bookingData.title = `Lab Test Booking - ${req.body.tests.length} tests`;
    }

    // For nurse orders, nursingCares array is REQUIRED
    if (bookingData.serviceType === 'nurse') {
      if (!req.body.nursingCares || !Array.isArray(req.body.nursingCares) || req.body.nursingCares.length === 0) {
        return res.status(400).json(errorResponse("At least one nursing care must be selected."));
      }
      bookingData.nursingCares = req.body.nursingCares;
      bookingData.preferredDate = req.body.preferredDate;
      bookingData.title = `Nurse Booking - ${req.body.nursingCares.map(c => c.name).join(', ')}`;
      if (req.body.preferredTime) {
        bookingData.requirements.preferredTime = req.body.preferredTime;
      }
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
    const statusCode = error.status || (error.message.includes("already been accepted") ? 409 : 500);
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

    const validStatuses = ["preparing", "ready", "on_the_way", "reached", "in_progress", "completed", "cancelled"];
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

    // Auto-expire requested bookings older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await RealTimeBooking.updateMany(
      {
        patient: patientId,
        status: { $in: ['pending', 'requested'] },
        createdAt: { $lt: twentyFourHoursAgo }
      },
      { $set: { status: 'expired' } }
    );

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

    // Auto-expire requested bookings older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await RealTimeBooking.updateMany(
      {
        patient: patientId,
        status: { $in: ['pending', 'requested'] },
        createdAt: { $lt: twentyFourHoursAgo }
      },
      { $set: { status: 'expired' } }
    );

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

    // Auto-expire requested bookings older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await RealTimeBooking.updateMany(
      {
        "notifiedProviders.provider": providerId,
        status: { $in: ['pending', 'requested'] },
        createdAt: { $lt: twentyFourHoursAgo }
      },
      { $set: { status: 'expired' } }
    );

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

    // Auto-expire requested bookings older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await RealTimeBooking.updateMany(
      {
        "notifiedProviders.provider": providerId,
        status: { $in: ['pending', 'requested'] },
        createdAt: { $lt: twentyFourHoursAgo }
      },
      { $set: { status: 'expired' } }
    );

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

const syncCart = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { serviceType, medicines, tests, price } = req.body;
    
    if (!serviceType) {
      return res.status(400).json(errorResponse("serviceType is required"));
    }
    
    // Resolve full medicine details with prices and names if only ID & quantity is passed
    let fullMedicines = medicines;
    if (medicines && Array.isArray(medicines) && serviceType === 'pharmacist') {
      const { Medicine } = await import('../models/Medicine.model.js');
      fullMedicines = await Promise.all(medicines.map(async (item) => {
        if (!item.medicineId) return null;
        if (item.name && item.price) return item; // Already resolved
        const medicine = await Medicine.findById(item.medicineId);
        if (!medicine) return null;
        return {
          medicineId: medicine._id,
          name: medicine.name,
          quantity: item.quantity || 1,
          price: medicine.discountedPrice || medicine.price,
        };
      }));
      fullMedicines = fullMedicines.filter(m => m !== null);
    }
    
    let calculatedPrice = price;
    if (!calculatedPrice && fullMedicines) {
      calculatedPrice = fullMedicines.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    const cartData = { medicines: fullMedicines, tests, price: calculatedPrice };
    const cart = await realTimeBookingService.syncCart(patientId, serviceType, cartData);
    
    res.json(successResponse("Cart synced successfully", cart));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to sync cart"));
  }
};

const getCart = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { serviceType } = req.query;
    
    if (!serviceType) {
      return res.status(400).json(errorResponse("serviceType query param is required"));
    }
    
    const cart = await realTimeBookingService.getCart(patientId, serviceType);
    res.json(successResponse("Cart retrieved", cart || {}));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to get cart"));
  }
};

const checkoutCart = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const checkoutData = {
      location: {
        address: req.body.address || req.body.location?.address || '',
        coordinates: req.body.coordinates || req.body.location?.coordinates || [72.8777, 19.0760],
      },
      patientName: req.body.name || req.body.patientName,
      patientPhone: req.body.phone || req.body.patientPhone || req.body.contactNumber,
      paymentMethod: req.body.paymentMethod || 'COD',
      notes: req.body.notes,
    };
    
    if (!checkoutData.location.address) {
      return res.status(400).json(errorResponse("Delivery address is required"));
    }
    
    const booking = await realTimeBookingService.checkoutCart(bookingId, checkoutData);
    res.json(successResponse("Checkout successful, order placed", booking));
  } catch (error) {
    const statusCode = error.status || 500;
    res.status(statusCode).json(errorResponse(error.message || "Failed to checkout cart"));
  }
};

const submitOfferForBooking = async (req, res) => {
  try {
    const vendorId = req.user.userId;
    const { bookingId } = req.params;
    const { amount, deliveryTime, note } = req.body;

    if (!amount) {
      return res.status(400).json(errorResponse('Amount is required'));
    }

    const booking = await RealTimeBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json(errorResponse('Booking request not found'));
    }

    if (booking.status !== 'requested' && booking.status !== 'pending') {
      return res.status(400).json(errorResponse('Booking is no longer accepting offers'));
    }

    // Check if offer already submitted by this vendor
    const existingOffer = booking.offers?.find(o => o.vendorId.toString() === vendorId.toString());
    if (existingOffer) {
      return res.status(400).json(errorResponse('You have already submitted an offer for this request'));
    }

    const newOffer = {
      vendorId,
      amount: Number(amount),
      deliveryTime: deliveryTime || 'Standard',
      note: note || '',
      status: 'pending',
      createdAt: new Date()
    };

    if (!booking.offers) {
      booking.offers = [];
    }

    booking.offers.push(newOffer);
    await booking.save();

    // Notify patient
    const { notificationService } = await import('../services/notification.service.js');
    const { getSocketHandler } = await import('../socket/socket.handler.js');

    await notificationService.send({
      recipient: booking.patient,
      sender: vendorId,
      type: "booking_update",
      title: `New Offer for ${booking.serviceType}`,
      message: `A provider has submitted an offer of ₹${amount} for your booking request.`,
      data: { bookingId: booking._id },
      sendPush: true,
    });

    try {
      const socketHandler = getSocketHandler();
      socketHandler.emitToUser(booking.patient.toString(), "booking:new_offer", {
        bookingId: booking._id,
        offer: newOffer
      });
    } catch (_) {}

    res.json(successResponse('Offer submitted successfully.', newOffer));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to submit offer'));
  }
};

const approveBookingOffer = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { bookingId } = req.params;
    const { offerId, vendorId } = req.body;

    const booking = await RealTimeBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json(errorResponse('Booking request not found'));
    }

    if (booking.patient.toString() !== patientId.toString()) {
      return res.status(403).json(errorResponse('You are not authorized to approve offers for this booking'));
    }

    if (booking.status !== 'requested') {
      return res.status(400).json(errorResponse(`Booking is already ${booking.status}`));
    }

    // Find the offer
    let targetOffer;
    if (offerId) {
      targetOffer = booking.offers.find(o => o._id.toString() === offerId.toString());
    } else if (vendorId) {
      targetOffer = booking.offers.find(o => o.vendorId.toString() === vendorId.toString());
    }

    if (!targetOffer) {
      return res.status(404).json(errorResponse('Offer not found'));
    }

    // Update the offer status
    targetOffer.status = 'accepted';

    // Reject all other offers
    booking.offers.forEach(o => {
      if (o._id.toString() !== targetOffer._id.toString()) {
        o.status = 'rejected';
      }
    });

    // Update booking status and acceptedProvider
    booking.status = 'accepted';
    booking.acceptedProvider = targetOffer.vendorId;
    booking.totalAmount = targetOffer.amount;
    booking.price = targetOffer.amount; // Ensure sync

    await booking.save();

    // Notify accepted vendor
    const { notificationService } = await import('../services/notification.service.js');
    const { getSocketHandler } = await import('../socket/socket.handler.js');

    await notificationService.send({
      recipient: targetOffer.vendorId,
      sender: patientId,
      type: "booking_update",
      title: "Offer Approved",
      message: `The patient has approved your offer of ₹${targetOffer.amount}.`,
      data: { bookingId: booking._id },
      sendPush: true,
    });

    try {
      const socketHandler = getSocketHandler();
      socketHandler.emitToUser(targetOffer.vendorId.toString(), "booking:offer_approved", {
        bookingId: booking._id,
        offerId: targetOffer._id
      });
    } catch (_) {}

    res.json(successResponse('Offer approved successfully.', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to approve offer'));
  }
};

const rejectBookingOffer = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { bookingId } = req.params;
    const { offerId, vendorId } = req.body;

    const booking = await RealTimeBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json(errorResponse('Booking request not found'));
    }

    if (booking.patient.toString() !== patientId.toString()) {
      return res.status(403).json(errorResponse('You are not authorized to modify this booking'));
    }

    // Find the offer
    let targetOffer;
    if (offerId) {
      targetOffer = booking.offers.find(o => o._id.toString() === offerId.toString());
    } else if (vendorId) {
      targetOffer = booking.offers.find(o => o.vendorId.toString() === vendorId.toString());
    }

    if (!targetOffer) {
      return res.status(404).json(errorResponse('Offer not found'));
    }

    targetOffer.status = 'rejected';
    await booking.save();

    res.json(successResponse('Offer rejected successfully.', booking));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to reject offer'));
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
  syncCart,
  getCart,
  checkoutCart,
  submitOfferForBooking,
  approveBookingOffer,
  rejectBookingOffer,
};
