import { paymentService } from '../services/payment.service.js';
import { logger } from '../utils/logger.util.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

/**
 * Create Order - SIMPLIFIED (No Razorpay)
 * POST /api/v1/payments/create-order
 * For COD: keeps payment pending
 * For ONLINE: marks as paid directly
 */
export const createOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json(errorResponse('Booking ID is required'));
    }

    const orderDetails = await paymentService.createOrder(bookingId);

    res.status(200).json(successResponse('Order created successfully', orderDetails));
  } catch (error) {
    logger.error('Create order endpoint failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Verify Payment - SIMPLIFIED (No Razorpay signature check)
 * POST /api/v1/payments/verify
 * Just confirms the booking
 */
export const verifyPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json(errorResponse('Booking ID is required'));
    }

    // RAZORPAY FIELDS - COMMENTED OUT
    // const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const booking = await paymentService.verifyPayment({
      bookingId,
      // razorpay_order_id,
      // razorpay_payment_id,
      // razorpay_signature,
    });

    res.status(200).json(successResponse('Payment verified successfully', {
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      amount: booking.amount,
      commission: booking.commission,
      vendorAmount: booking.vendorAmount,
    }));
  } catch (error) {
    logger.error('Verify payment endpoint failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Setup vendor bank details for payouts
 * POST /api/v1/payments/vendor/bank-details
 */
export const setupVendorBankDetails = async (req, res) => {
  try {
    const vendorId = req.user.userId;
    const { accountHolderName, accountNumber, ifsc } = req.body;

    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json(errorResponse('All bank details are required'));
    }

    // Validate IFSC format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      return res.status(400).json(errorResponse('Invalid IFSC code format'));
    }

    const vendor = await paymentService.setupVendorPayout(vendorId, {
      accountHolderName,
      accountNumber,
      ifsc,
    });

    res.status(200).json(successResponse('Bank details saved successfully', {
      vendorId: vendor._id,
      bankDetails: vendor.bankDetails,
    }));
  } catch (error) {
    logger.error('Setup vendor bank details failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Get payment details for a booking
 * GET /api/v1/payments/:id
 */
export const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentDetails = await paymentService.getPaymentDetails(id);

    res.status(200).json(successResponse('Payment details retrieved', paymentDetails));
  } catch (error) {
    logger.error('Get payment details failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Manually trigger payout (admin only)
 * POST /api/v1/payments/release-payout
 */
export const releasePayout = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json(errorResponse('Booking ID is required'));
    }

    const booking = await paymentService.releasePaymentToVendor(bookingId);

    res.status(200).json(successResponse('Payout released successfully', {
      bookingId: booking._id,
      amount: booking.vendorAmount,
      paymentStatus: booking.paymentStatus,
    }));
  } catch (error) {
    logger.error('Release payout failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};
