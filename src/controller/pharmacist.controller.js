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

    // Import RealTimeBooking model
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');

    // Build query for pharmacist orders
    const query = {
      serviceType: 'pharmacist',
    };

    // If status is 'all', show both pending orders and accepted orders by this pharmacist
    if (status === 'all') {
      query.$or = [
        { acceptedProvider: pharmacistId }, // Orders accepted by this pharmacist
        { status: 'pending', acceptedProvider: { $exists: false } }, // Pending orders available to all
      ];
    } else if (status === 'pending' || status === 'requested') {
      // Show only pending orders not yet accepted by anyone
      // Support both 'pending' and 'requested' for flexibility
      query.status = 'pending';
      query.acceptedProvider = { $exists: false };
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
      // Default: show both pending orders and accepted orders (same as 'all')
      query.$or = [
        { acceptedProvider: pharmacistId }, // Orders accepted by this pharmacist
        { status: 'pending', acceptedProvider: { $exists: false } }, // Pending orders available to all
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
    const transformedOrders = orders.map(order => ({
      ...order,
      patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
      patientPhone: order.patient?.phone || 'N/A',
      deliveryAddress: order.location?.address || 'N/A',
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
    const { page = 1, limit = 20 } = req.query;
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');

    // Find all pending medicine orders without assigned provider
    const query = {
      serviceType: 'pharmacist',
      status: 'pending',
      acceptedProvider: { $exists: false }, // Orders not yet accepted by any pharmacist
    };

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

    // Transform orders to include flattened patient info and delivery address
    const transformedOrders = orders.map(order => ({
      ...order,
      patientName: order.patient ? `${order.patient.firstName} ${order.patient.lastName}` : 'Unknown',
      patientPhone: order.patient?.phone || 'N/A',
      deliveryAddress: order.location?.address || 'N/A',
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
    res.status(error.statusCode || 500)
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
      { new: true }
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

    const [pendingOrders, activeOrders, completedOrders, pharmacist, totalMedicines, lowStock] = await Promise.all([
      RealTimeBooking.countDocuments({
        serviceType: 'pharmacist',
        status: 'pending',
        acceptedProvider: { $exists: false },
      }),
      RealTimeBooking.countDocuments({
        serviceType: 'pharmacist',
        acceptedProvider: pharmacistId,
        status: { $in: ['accepted', 'on_the_way', 'in_progress'] },
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
};