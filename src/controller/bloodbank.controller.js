import { BloodBank } from '../models/BloodBank.model.js';
import { Booking } from '../models/Booking.model.js';
import { bookingService } from '../services/booking.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.util.js';
import { ServiceType } from '../types/index.js';

const updateProfile = async (req, res) => {
  try {
    const bloodBankId = req.user.userId;
    const updates = req.body;

    const bloodBank = await BloodBank.findByIdAndUpdate(bloodBankId, updates, {
      new: true,
    });

    res.json(successResponse('Profile updated successfully', bloodBank));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to update profile'));
  }
};

const getStock = async (req, res) => {
  try {
    const bloodBankId = req.user.userId;

    const bloodBank = await BloodBank.findById(bloodBankId).select('bloodStock');

    res.json(successResponse('Blood stock fetched', bloodBank?.bloodStock || []));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || 'Failed to fetch stock'));
  }
};

const updateStock = async (req, res) => {
  try {
    const bloodBankId = req.user.userId;
    const { bloodGroup, unitsAvailable, pricePerUnit } = req.body;

    console.log('=== BLOOD BANK UPDATE STOCK ===');
    console.log('Blood Bank ID:', bloodBankId);
    console.log('Update data:', { bloodGroup, unitsAvailable, pricePerUnit });

    const bloodBank = await BloodBank.findById(bloodBankId);

    if (!bloodBank) {
      console.error('Blood bank not found:', bloodBankId);
      return res.status(404).json(errorResponse('Blood bank not found'));
    }

    const stockIndex = bloodBank.bloodStock.findIndex(
      (stock) => stock.bloodGroup === bloodGroup
    );

    if (stockIndex >= 0) {
      console.log('Updating existing stock at index:', stockIndex);
      bloodBank.bloodStock[stockIndex].unitsAvailable = unitsAvailable;
      if (pricePerUnit !== undefined) {
        bloodBank.bloodStock[stockIndex].pricePerUnit = pricePerUnit;
      }
      bloodBank.bloodStock[stockIndex].lastUpdated = new Date();
    } else {
      console.log('Adding new stock entry');
      bloodBank.bloodStock.push({
        bloodGroup,
        unitsAvailable,
        pricePerUnit: pricePerUnit || 0,
        lastUpdated: new Date(),
      });
    }

    await bloodBank.save();

    console.log('Stock updated successfully');
    console.log('New stock:', bloodBank.bloodStock);

    res.json(successResponse('Stock updated', bloodBank.bloodStock));
  } catch (error) {
    console.error('=== BLOOD BANK UPDATE STOCK ERROR ===');
    console.error('Error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to update stock'));
  }
};

const getRequests = async (req, res) => {
  try {
    const bloodBankId = req.user.userId;
    const { status, page, limit } = req.query;

    console.log('=== BLOOD BANK GET REQUESTS ===');
    console.log('Blood Bank ID:', bloodBankId);
    console.log('Query params:', { status, page, limit });

    const filters = {
      status,
      serviceType: 'bloodbank', // Use string directly instead of ServiceType.BLOOD_BANK
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    console.log('Filters:', filters);

    const { bookings, total } = await bookingService.getUserBookings(
      bloodBankId,
      'provider',
      filters
    );

    console.log('Results:', { bookingsCount: bookings.length, total });
    if (bookings.length > 0) {
      console.log('Sample booking data:');
      console.log('- bloodGroup:', bookings[0].bloodGroup);
      console.log('- unitsRequired:', bookings[0].unitsRequired);
      console.log('- price:', bookings[0].price);
      console.log('- serviceType:', bookings[0].serviceType);
    }

    res.json(
      paginatedResponse('Blood requests fetched', bookings, filters.page, filters.limit, total)
    );
  } catch (error) {
    console.error('=== BLOOD BANK GET REQUESTS ERROR ===');
    console.error('Error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch requests'));
  }
};

const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const bloodBankId = req.user.userId;

    console.log('=== BLOOD BANK ACCEPT REQUEST ===');
    console.log('Booking ID:', id);
    console.log('Blood Bank ID:', bloodBankId);

    // Validate booking exists and belongs to this blood bank
    const existingBooking = await Booking.findById(id);
    if (!existingBooking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (existingBooking.provider.toString() !== bloodBankId) {
      return res.status(403).json(errorResponse('This booking is not assigned to your blood bank'));
    }

    if (existingBooking.status !== 'requested') {
      return res.status(400).json(errorResponse(`Cannot accept booking with status: ${existingBooking.status}`));
    }

    console.log('Validation passed, calling booking service...');

    const booking = await bookingService.acceptBooking(id, bloodBankId);

    console.log('Request accepted successfully');
    console.log('Booking status:', booking.status);

    res.json(successResponse('Blood request accepted', booking));
  } catch (error) {
    console.error('=== BLOOD BANK ACCEPT REQUEST ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to accept request'));
  }
};


const fulfillRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const bloodBankId = req.user.userId;
    const { bloodGroup, unitsProvided } = req.body;

    console.log('=== BLOOD BANK FULFILL REQUEST ===');
    console.log('Booking ID:', id);
    console.log('Blood Bank ID:', bloodBankId);
    console.log('Blood Group:', bloodGroup);
    console.log('Units Provided:', unitsProvided);

    // Get current booking to check status
    const currentBooking = await Booking.findById(id);
    if (!currentBooking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    console.log('Current booking status:', currentBooking.status);

    // Workflow: accepted → in_progress → completed
    // If status is 'accepted', first move to 'in_progress'
    if (currentBooking.status === 'accepted') {
      console.log('Moving from accepted to in_progress first');
      await bookingService.updateBookingStatus(
        id,
        bloodBankId,
        'in_progress'
      );
    }

    // Now move to completed
    console.log('Moving to completed');
    const booking = await bookingService.updateBookingStatus(
      id,
      bloodBankId,
      'completed'
    );

    console.log('Booking status updated to completed');

    const bloodBank = await BloodBank.findById(bloodBankId);

    if (bloodBank) {
      const stockIndex = bloodBank.bloodStock.findIndex(
        (stock) => stock.bloodGroup === bloodGroup
      );

      if (stockIndex >= 0) {
        console.log('Current stock:', bloodBank.bloodStock[stockIndex].unitsAvailable);
        
        if (bloodBank.bloodStock[stockIndex].unitsAvailable < unitsProvided) {
          console.error('Insufficient stock');
          return res.status(400).json(errorResponse(
            `Insufficient stock for ${bloodGroup}. Available: ${bloodBank.bloodStock[stockIndex].unitsAvailable}`
          ));
        }
        
        bloodBank.bloodStock[stockIndex].unitsAvailable -= unitsProvided;
        console.log('New stock:', bloodBank.bloodStock[stockIndex].unitsAvailable);
        await bloodBank.save();
      }

      await BloodBank.findByIdAndUpdate(bloodBankId, {
        $inc: { totalRequests: 1 },
      });
      
      console.log('Total requests incremented');
    }

    console.log('Request fulfilled successfully');

    res.json(successResponse('Request fulfilled', booking));
  } catch (error) {
    console.error('=== BLOOD BANK FULFILL REQUEST ERROR ===');
    console.error('Error:', error);
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to fulfill request'));
  }
};


const getDashboard = async (req, res) => {
  try {
    const bloodBankId = req.user.userId;

    console.log('=== BLOOD BANK DASHBOARD ===');
    console.log('Blood Bank ID:', bloodBankId);

    const [activeRequests, bloodBank] = await Promise.all([
      bookingService.getActiveBookings(bloodBankId, 'provider'),
      BloodBank.findById(bloodBankId),
    ]);

    console.log('Active Requests:', activeRequests.length);
    console.log('Blood Bank:', bloodBank ? bloodBank.bankName : 'Not found');

    const totalUnits =
      bloodBank?.bloodStock.reduce((sum, stock) => sum + stock.unitsAvailable, 0) || 0;

    const dashboardData = {
      activeRequests: activeRequests.length,
      totalRequests: bloodBank?.totalRequests || 0,
      totalUnitsAvailable: totalUnits,
      bloodStock: bloodBank?.bloodStock || [],
      status: bloodBank?.status || 'active', // Include vendor approval status
      bankName: bloodBank?.bankName || '',
    };

    console.log('Dashboard Data:', dashboardData);

    res.json(successResponse('Dashboard data fetched', dashboardData));
  } catch (error) {
    console.error('=== BLOOD BANK DASHBOARD ERROR ===');
    console.error('Error:', error);
    res.status(500).json(errorResponse(error.message || 'Failed to fetch dashboard'));
  }
};

const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const bloodBankId = req.user.userId;
    const { reason } = req.body;

    console.log('=== BLOOD BANK CANCEL REQUEST ===');
    console.log('Booking ID:', id);
    console.log('Blood Bank ID:', bloodBankId);
    console.log('Reason:', reason);

    const booking = await bookingService.cancelBooking(id, bloodBankId, reason || 'Cancelled by blood bank');

    console.log('Request cancelled successfully');

    res.json(successResponse('Blood request cancelled', booking));
  } catch (error) {
    console.error('=== BLOOD BANK CANCEL REQUEST ERROR ===');
    console.error('Error:', error);
    res.status(error.statusCode || 500)
      .json(errorResponse(error.message || 'Failed to cancel request'));
  }
};

export {
  updateProfile,
  getStock,
  updateStock,
  getRequests,
  acceptRequest,
  fulfillRequest,
  cancelRequest, // Add cancel function
  getDashboard,
};