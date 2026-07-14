import { Medicine } from '../models/Medicine.model.js';
import { Pharmacist } from '../models/Pharmacist.model.js';
import { bookingService } from '../services/booking.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType } from '../types/index.js';

const updateProfile = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const updates = req.body;

    const pharmacist = await Pharmacist.findByIdAndUpdate(
      pharmacistId,
      updates,
      { new: true }
    );

    res.json(successResponse('Profile updated successfully', pharmacist));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};


const addMedicine = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;

    const medicineData = {
      ...req.body,
      pharmacist: pharmacistId,
    };

    const medicine = await Medicine.create(medicineData);

    res.status(201).json(successResponse('Medicine added successfully', medicine));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to add medicine'));
  }
};

const updateMedicine = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { id } = req.params;

    const medicine = await Medicine.findOne({ _id: id, pharmacist: pharmacistId });
    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    const updatedMedicine = await Medicine.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    res.json(successResponse('Medicine updated', updatedMedicine));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update medicine'));
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { id } = req.params;

    const medicine = await Medicine.findOneAndDelete({
      _id: id,
      pharmacist: pharmacistId,
    });

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    res.json(successResponse('Medicine deleted'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to delete medicine'));
  }
};

const getInventory = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { search, category, page = 1, limit = 20 } = req.query;

    const query = {
      pharmacist: pharmacistId,
      isActive: true,
    };

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [medicines, total] = await Promise.all([
      Medicine.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Medicine.countDocuments(query),
    ]);

    res.json(
      paginatedResponse(
        'Inventory fetched',
        medicines,
        Number(page),
        Number(limit),
        total
      )
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch inventory'));
  }
};

const getOrders = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    // Import RealTimeBooking model and User model
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const { User } = await import('../models/User.model.js');

    // Get pharmacist's city and state for geo-fencing
    const pharmacist = await User.findById(pharmacistId).select('city state status').lean();
    if (!pharmacist || pharmacist.status !== 'approved') {
      return res.json(paginatedResponse('Orders fetched', [], 1, Number(limit), 0));
    }

    // Build query for pharmacist orders
    const query = {
      serviceType: 'pharmacist',
    };

    // Build city/state filter for pending orders (case-insensitive)
    const locationFilter = {};
    if (pharmacist.city && pharmacist.city.trim()) {
      locationFilter.city = { $regex: new RegExp(`^${pharmacist.city.trim()}$`, 'i') };
    }
    if (pharmacist.state && pharmacist.state.trim()) {
      locationFilter.state = { $regex: new RegExp(`^${pharmacist.state.trim()}$`, 'i') };
    }

    // If status is 'all', show both pending orders and accepted orders by this pharmacist
    if (status === 'all') {
      query.$or = [
        { acceptedProvider: pharmacistId }, // Orders accepted by this pharmacist
        { 
          status: { $in: ['pending', 'requested'] }, 
          acceptedProvider: { $exists: false },
          ...locationFilter,
          $or: [
            { expiresAt: { $exists: false } }, // Orders without expiration
            { expiresAt: { $gt: new Date() } }, // Orders not yet expired
          ],
        }, // Pending/requested orders in same city/state
      ];
    } else if (status === 'pending' || status === 'requested') {
      // Show only pending/requested orders not yet accepted by anyone, in same city/state
      query.status = { $in: ['pending', 'requested'] };
      query.acceptedProvider = { $exists: false };
      Object.assign(query, locationFilter);
      query.$or = [
        { expiresAt: { $exists: false } }, // Orders without expiration
        { expiresAt: { $gt: new Date() } }, // Orders not yet expired
      ];
    } else if (status === 'confirmed' || status === 'accepted') {
      // Show accepted/confirmed orders by this pharmacist
      query.status = { $in: ['accepted', 'on_the_way', 'in_progress'] };
      query.acceptedProvider = pharmacistId;
    } else if (status === 'completed') {
      // Show completed orders by this pharmacist
      query.status = 'completed';
      query.acceptedProvider = pharmacistId;
    } else if (status) {
      // For any other specific status, show only orders accepted by this pharmacist
      query.status = status;
      query.acceptedProvider = pharmacistId;
    } else {
      // Default: show both pending/requested orders (filtered by city/state) and accepted orders
      query.$or = [
        { acceptedProvider: pharmacistId }, // Orders accepted by this pharmacist
        { 
          status: { $in: ['pending', 'requested'] }, 
          acceptedProvider: { $exists: false },
          ...locationFilter,
          $or: [
            { expiresAt: { $exists: false } }, // Orders without expiration
            { expiresAt: { $gt: new Date() } }, // Orders not yet expired
          ],
        }, // Pending/requested orders in same city/state
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate('patient', 'firstName lastName phone email address location')
        .populate('acceptedProvider', 'firstName lastName phone')
        .populate('medicines.medicineId', 'name description manufacturer')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

    // Transform orders to include flattened patient info and delivery address
    const { s3Service } = await import('../services/s3.service.js');
    const transformedOrders = await Promise.all(orders.map(async (order) => {
      const transformed = {
        ...order,
        patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
        patientPhone: order.patient?.phone || 'N/A',
        deliveryAddress: order.location?.address || 'N/A',
      };
      
      if (transformed.prescriptionImages && transformed.prescriptionImages.length > 0) {
        transformed.prescriptionImages = transformed.prescriptionImages.map(img => s3Service.cleanS3Url(img));
      }
      
      return transformed;
    }));

    res.json(
      paginatedResponse('Orders fetched', transformedOrders, Number(page), Number(limit), total)
    );
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch orders'));
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const { User } = await import('../models/User.model.js');

    // Get pharmacist's city and state for geo-fencing
    const pharmacist = await User.findById(pharmacistId).select('city state status').lean();
    if (!pharmacist || pharmacist.status !== 'approved') {
      return res.json(paginatedResponse('Pending orders fetched', [], 1, Number(limit), 0));
    }

    console.log('🏥 Pharmacist Location:', {
      pharmacistId,
      city: pharmacist.city,
      state: pharmacist.state,
      status: pharmacist.status
    });

    // Find pending/requested medicine orders filtered by pharmacist's city and state
    const query = {
      serviceType: 'pharmacist',
      status: { $in: ['pending', 'requested'] },
      acceptedProvider: { $exists: false }, // Orders not yet accepted by any pharmacist
      $or: [
        { expiresAt: { $exists: false } }, // Orders without expiration
        { expiresAt: { $gt: new Date() } }, // Orders not yet expired
      ],
    };

    // Geo-fence: only show orders from same city and state
    if (pharmacist.city && pharmacist.city.trim()) {
      query.city = { $regex: new RegExp(`^${pharmacist.city.trim()}$`, 'i') };
    }
    if (pharmacist.state && pharmacist.state.trim()) {
      query.state = { $regex: new RegExp(`^${pharmacist.state.trim()}$`, 'i') };
    }

    console.log('🔍 Query for pending orders:', JSON.stringify(query, null, 2));

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      RealTimeBooking.find(query)
        .populate('patient', 'firstName lastName phone address location')
        .populate('medicines.medicineId', 'name description manufacturer')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      RealTimeBooking.countDocuments(query),
    ]);

    console.log('📦 Found orders:', {
      total,
      ordersCount: orders.length,
      sampleOrder: orders[0] ? {
        id: orders[0]._id,
        city: orders[0].city,
        state: orders[0].state,
        isPrescriptionBased: orders[0].isPrescriptionBased,
        status: orders[0].status
      } : 'No orders'
    });

    // Transform orders to include flattened patient info and delivery address
    const { s3Service } = await import('../services/s3.service.js');
    const transformedOrders = await Promise.all(orders.map(async (order) => {
      const transformed = {
        ...order,
        patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
        patientPhone: order.patient?.phone || 'N/A',
        deliveryAddress: order.location?.address || 'N/A',
      };
      
      if (transformed.prescriptionImages && transformed.prescriptionImages.length > 0) {
        transformed.prescriptionImages = transformed.prescriptionImages.map(img => s3Service.cleanS3Url(img));
      }
      
      return transformed;
    }));

    res.json(
      paginatedResponse('Pending orders fetched', transformedOrders, Number(page), Number(limit), total)
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch pending orders'));
  }
};

const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const pharmacistId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');

    // Use realtime booking service to accept the order
    const booking = await realTimeBookingService.acceptBooking(id, pharmacistId);

    res.json(successResponse('Order accepted', booking));
  } catch (error) {
    // Return 403 for unapproved accounts instead of 500
    const statusCode = error.message?.includes('not approved') ? 403 : (error.status || error.statusCode || 500);
    res.status(statusCode)
      .json(errorResponse(error.message || 'Failed to accept order'));
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const pharmacistId = req.user.userId;

    const { realTimeBookingService } = await import('../services/realTimeBooking.service.js');

    // Use realtime booking service to update status
    const booking = await realTimeBookingService.updateBookingStatus(
      id,
      pharmacistId,
      status
    );

    res.json(successResponse('Order status updated', booking));
  } catch (error) {
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to update status'));
  }
};

const updateStock = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { id } = req.params;
    const { stock } = req.body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, pharmacist: pharmacistId },
      { stock },
      { returnDocument: 'after' }
    );

    if (!medicine) {
      return res.status(404).json(errorResponse('Medicine not found'));
    }

    res.json(successResponse('Stock updated', medicine));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update stock'));
  }
};

const getDashboard = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const { User } = await import('../models/User.model.js');

    // Get pharmacist's city and state for geo-fencing
    const pharmacistUser = await User.findById(pharmacistId).select('city state status').lean();
    if (!pharmacistUser || pharmacistUser.status !== 'approved') {
      return res.json(successResponse('Dashboard data fetched', {
        pendingOrders: 0,
        activeOrders: 0,
        completedOrders: 0,
        totalOrders: 0,
        totalMedicines: 0,
        lowStockItems: 0,
        rating: { average: 0, count: 0 },
      }));
    }

    // Build location filter for pending orders
    const pendingQuery = {
      serviceType: 'pharmacist',
      status: { $in: ['pending', 'requested'] },
      acceptedProvider: { $exists: false },
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    };
    if (pharmacistUser.city && pharmacistUser.city.trim()) {
      pendingQuery.city = { $regex: new RegExp(`^${pharmacistUser.city.trim()}$`, 'i') };
    }
    if (pharmacistUser.state && pharmacistUser.state.trim()) {
      pendingQuery.state = { $regex: new RegExp(`^${pharmacistUser.state.trim()}$`, 'i') };
    }

    const [pendingOrders, activeOrders, completedOrders, pharmacist, totalMedicines, lowStock] = await Promise.all([
      RealTimeBooking.countDocuments(pendingQuery),
      RealTimeBooking.countDocuments({
        serviceType: 'pharmacist',
        acceptedProvider: pharmacistId,
        status: { $in: ['accepted', 'preparing', 'ready', 'on_the_way', 'in_progress'] },
      }),
      RealTimeBooking.countDocuments({
        serviceType: 'pharmacist',
        acceptedProvider: pharmacistId,
        status: 'completed',
      }),
      Pharmacist.findById(pharmacistId),
      Medicine.countDocuments({ pharmacist: pharmacistId, isActive: true }),
      Medicine.countDocuments({ pharmacist: pharmacistId, stock: { $lt: 10 } }),
    ]);

    const dashboardData = {
      pendingOrders,
      activeOrders,
      completedOrders,
      totalOrders: completedOrders,
      totalMedicines,
      lowStockItems: lowStock,
      rating: pharmacist?.rating || { average: 0, count: 0 },
    };

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};


const submitOffer = async (req, res) => {
  try {
    const pharmacistId = req.user.userId;
    const { id } = req.params;
    const { amount, deliveryTime } = req.body;

    if (!amount || !deliveryTime) {
      return res.status(400).json(errorResponse('Amount and delivery time are required'));
    }

    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
    const { notificationService } = await import('../services/notification.service.js');
    const { getSocketHandler } = await import('../socket/socket.handler.js');

    const booking = await RealTimeBooking.findById(id);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.status !== 'requested') {
      return res.status(400).json(errorResponse('Booking is no longer accepting offers'));
    }

    // Check if offer already submitted by this vendor
    const existingOffer = booking.offers?.find(o => o.vendorId.toString() === pharmacistId.toString());
    if (existingOffer) {
      return res.status(400).json(errorResponse('You have already submitted an offer for this order'));
    }

    // Add new offer
    const newOffer = {
      vendorId: pharmacistId,
      amount: Number(amount),
      deliveryTime,
      status: 'pending',
      createdAt: new Date()
    };

    if (!booking.offers) {
      booking.offers = [];
    }
    
    booking.offers.push(newOffer);
    await booking.save();

    // Notify patient
    await notificationService.send({
      recipient: booking.patient,
      sender: pharmacistId,
      type: "booking_update",
      title: "New Prescription Offer",
      message: `A pharmacy has submitted an offer of ₹${amount} for your prescription.`,
      data: { bookingId: booking._id },
      sendPush: true,
    });

    const socketHandler = getSocketHandler();
    socketHandler.emitToUser(booking.patient.toString(), "booking:new_offer", {
      bookingId: booking._id,
      offer: newOffer
    });

    res.json(successResponse('Offer submitted successfully. Waiting for patient approval.', newOffer));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to submit offer'));
  }
};

export {
  updateProfile,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getInventory,
  getOrders,
  getPendingOrders,
  acceptOrder,
  updateOrderStatus,
  updateStock,
  getDashboard,
  submitOffer,
};