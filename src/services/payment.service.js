// RAZORPAY INTEGRATION - COMMENTED OUT FOR NOW
// Will be implemented later
// import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.model.js';
import { User } from '../models/User.model.js';
import { zoomService } from './zoom.service.js';
import { notificationService } from './notification.service.js';
import { logger } from '../utils/logger.util.js';
import { sanitizeForLog } from '../utils/sanitize.util.js';

class PaymentService {
  constructor() {
    // RAZORPAY - COMMENTED OUT
    // this.razorpay = new Razorpay({
    //   key_id: process.env.RAZORPAY_KEY_ID,
    //   key_secret: process.env.RAZORPAY_KEY_SECRET,
    // });

    // FIXED: Service-specific commission rates
    this.commissionRates = {
      doctor: 0.15,      // 15%
      nurse: 0.12,       // 12%
      ambulance: 0.10,   // 10%
      pharmacist: 0.08,  // 8%
      bloodbank: 0.05,   // 5%
      pathology: 0.10,   // 10%
    };

    this.minimumCommission = 10; // ₹10 minimum
  }

  /**
   * Calculate commission based on service type
   */
  calculateCommission(amount, serviceType) {
    const rate = this.commissionRates[serviceType] || 0.10;
    const commission = Math.round(amount * rate);
    
    // Ensure minimum commission
    return Math.max(commission, this.minimumCommission);
  }

  /**
   * Create Order - PAYMENT DISABLED
   * Directly confirms booking without payment gateway
   */
  async createOrder(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('patient provider');

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.paymentStatus === 'paid') {
        throw new Error('Booking already paid');
      }

      // Calculate commission based on service type
      const commission = this.calculateCommission(booking.price, booking.serviceType);
      const vendorAmount = booking.price - commission;

      // FIXED: Validate vendor amount is non-negative
      if (vendorAmount < 0) {
        throw new Error(`Invalid commission calculation - vendor amount cannot be negative (price: ${booking.price}, commission: ${commission})`);
      }

      // PAYMENT DISABLED - Directly confirm booking
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.paymentMethod = 'cash';

      // Update booking with payment details
      booking.amount = booking.price;
      booking.commission = commission;
      booking.vendorAmount = vendorAmount;

      // Create Zoom meeting for video call bookings during auto-confirmation
      const isVideoCall = booking.consultationType && ['video-call', 'VIDEO_CALL'].includes(String(booking.consultationType));
      if (booking.serviceType === 'doctor' && isVideoCall && !booking.zoomMeetingId && !booking.meetingId) {
        try {
          const doctorName = booking.provider ? `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim() : 'Doctor';
          const meeting = await zoomService.createMeeting({
            topic: `Consultation with Dr. ${doctorName}`,
            startTime: booking.scheduledTime,
            duration: booking.duration || 30,
            agenda: booking.notes || 'Medical consultation',
          });

          booking.meetingLink = meeting.join_url || meeting.meetingLink;
          booking.meetingId = String(meeting.id || meeting.meetingId);
          booking.meetingPassword = meeting.password || meeting.meetingPassword || '';
          booking.hostLink = meeting.start_url || meeting.hostLink;

          booking.zoomMeetingId = booking.meetingId;
          booking.zoomMeetingPassword = booking.meetingPassword;
          booking.zoomJoinUrl = booking.meetingLink;
          booking.zoomHostStartUrl = booking.hostLink;

          logger.info('Zoom meeting created during createOrder auto-confirm', sanitizeForLog({
            bookingId,
            meetingId: booking.meetingId,
          }));
        } catch (zoomErr) {
          logger.error('Failed to create Zoom meeting in createOrder', sanitizeForLog({
            bookingId,
            error: zoomErr.message,
          }));
        }
      }

      await booking.save();

      logger.info('Booking auto-confirmed without payment', sanitizeForLog({
        bookingId,
        amount: booking.price,
        commission,
        vendorAmount,
      }));

      return {
        bookingId,
        amount: booking.price,
        currency: 'INR',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        message: 'Booking confirmed without payment',
      };
    } catch (error) {
      logger.error('Create order failed', sanitizeForLog({ 
        error: error.message, 
        bookingId 
      }));
      throw error;
    }
  }

  /**
   * Verify Payment - PAYMENT DISABLED
   * Directly confirms booking without payment verification
   */
  async verifyPayment(paymentData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { bookingId } = paymentData;

      // Update booking within transaction
      const booking = await Booking.findById(bookingId)
        .populate('patient provider')
        .session(session);

      if (!booking) {
        await session.abortTransaction();
        throw new Error('Booking not found');
      }

      if (booking.paymentStatus === 'paid' && (booking.meetingId || booking.zoomMeetingId)) {
        await session.commitTransaction();
        return {
          bookingId,
          paymentStatus: 'paid',
          status: booking.status,
          message: 'Payment already verified and meeting ready',
        };
      }

      // PAYMENT DISABLED - Direct confirmation
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';

      // FIXED: Create Zoom meeting BEFORE committing transaction
      let meetingCreated = false;
      const isVideoCall = booking.consultationType && ['video-call', 'VIDEO_CALL'].includes(String(booking.consultationType));
      if (booking.serviceType === 'doctor' && isVideoCall) {
        try {
          const doctorName = booking.provider ? `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim() : 'Doctor';
          const meeting = await zoomService.createMeeting({
            topic: `Consultation with Dr. ${doctorName}`,
            startTime: booking.scheduledTime,
            duration: booking.duration || 30,
            agenda: booking.notes || 'Medical consultation',
          });

          // Set generic fields
          booking.meetingLink = meeting.join_url || meeting.meetingLink;
          booking.meetingId = String(meeting.id || meeting.meetingId);
          booking.meetingPassword = meeting.password || meeting.meetingPassword || '';
          booking.hostLink = meeting.start_url || meeting.hostLink;

          // Set zoom-specific fields for video.controller.js compatibility
          booking.zoomMeetingId = booking.meetingId;
          booking.zoomMeetingPassword = booking.meetingPassword;
          booking.zoomJoinUrl = booking.meetingLink;
          booking.zoomHostStartUrl = booking.hostLink;

          meetingCreated = true;

          logger.info('Zoom meeting created before transaction commit', sanitizeForLog({
            bookingId,
            meetingId: booking.meetingId,
          }));
        } catch (zoomError) {
          logger.error('Zoom creation failed - aborting transaction', sanitizeForLog({
            bookingId,
            error: zoomError.message,
          }));

          // Abort transaction if Zoom creation fails for video consultations
          await session.abortTransaction();
          throw new Error(`Payment verification failed: Unable to create video meeting - ${zoomError.message}`);
        }
      }

      // Save booking with all updates
      await booking.save({ session });

      // Commit transaction only after all operations succeed
      await session.commitTransaction();

      // Send notifications (after transaction commits)
      try {
        await notificationService.sendBookingAccepted(
          booking.patient._id,
          booking.provider._id,
          { id: booking._id }
        );

        if (meetingCreated) {
          await notificationService.send({
            recipient: booking.patient._id,
            type: 'meeting_created',
            title: 'Video Consultation Link Ready',
            message: 'Your video consultation link has been created. You will receive a reminder before the meeting.',
            data: {
              bookingId: booking._id,
              meetingLink: booking.meetingLink,
            },
            sendPush: true,
          });
        }
      } catch (notificationError) {
        logger.error('Notification failed after payment', sanitizeForLog({
          error: notificationError.message,
          bookingId,
        }));
        // Don't fail - notifications are not critical
      }

      logger.info('Payment verified successfully (simplified)', sanitizeForLog({
        bookingId,
        paymentMethod: booking.paymentMethod,
        meetingCreated,
      }));

      return booking;

    } catch (error) {
      await session.abortTransaction();
      logger.error('Verify payment failed', sanitizeForLog({ 
        error: error.message, 
        bookingId: paymentData.bookingId 
      }));
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Setup vendor bank details for payouts
   * RAZORPAY PAYOUT - COMMENTED OUT FOR NOW
   */
  async setupVendorPayout(vendorId, bankDetails) {
    try {
      const { accountHolderName, accountNumber, ifsc } = bankDetails;

      // Validate IFSC format
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifsc)) {
        throw new Error('Invalid IFSC code format');
      }

      const vendor = await User.findById(vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // RAZORPAY CONTACT/FUND ACCOUNT CREATION - COMMENTED OUT
      // const contact = await this.razorpay.contacts.create({
      //   name: accountHolderName,
      //   email: vendor.email,
      //   contact: vendor.phone,
      //   type: 'vendor',
      //   reference_id: vendorId.toString(),
      // });

      // const fundAccount = await this.razorpay.fundAccount.create({
      //   contact_id: contact.id,
      //   account_type: 'bank_account',
      //   bank_account: {
      //     name: accountHolderName,
      //     ifsc: ifsc,
      //     account_number: accountNumber,
      //   },
      // });

      // Update vendor details (without Razorpay IDs for now)
      // vendor.razorpayContactId = contact.id;
      // vendor.razorpayFundAccountId = fundAccount.id;
      vendor.bankDetails = {
        accountHolderName,
        accountNumber,
        ifsc,
        verifiedAt: new Date(),
      };
      await vendor.save();

      logger.info('Vendor bank details saved (simplified)', sanitizeForLog({
        vendorId,
      }));

      return vendor;
    } catch (error) {
      logger.error('Setup vendor payout failed', sanitizeForLog({ 
        error: error.message, 
        vendorId 
      }));
      throw error;
    }
  }

  /**
   * Release payment to vendor after service completion
   * RAZORPAY PAYOUT - COMMENTED OUT FOR NOW
   */
  async releasePaymentToVendor(bookingId) {
    try {
      const booking = await Booking.findById(bookingId).populate('provider');

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.paymentStatus === 'released') {
        throw new Error('Payment already released to vendor');
      }

      if (booking.paymentStatus !== 'paid') {
        throw new Error('Payment not received yet');
      }

      if (booking.status !== 'completed') {
        throw new Error('Service not completed yet');
      }

      const vendor = booking.provider;

      // RAZORPAY PAYOUT - COMMENTED OUT
      // if (!vendor.razorpayFundAccountId) {
      //   throw new Error('Vendor bank details not configured');
      // }

      // const payout = await this.razorpay.payouts.create({
      //   account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      //   fund_account_id: vendor.razorpayFundAccountId,
      //   amount: Math.round(booking.vendorAmount * 100),
      //   currency: 'INR',
      //   mode: 'IMPS',
      //   purpose: 'payout',
      //   queue_if_low_balance: true,
      //   reference_id: `booking_${bookingId}`,
      //   narration: `Payment for booking ${bookingId}`,
      // });

      // Update booking (without Razorpay payout for now)
      booking.paymentStatus = 'released';
      // booking.razorpayPayoutId = payout.id;
      booking.payoutReleasedAt = new Date();
      await booking.save();

      logger.info('Payment marked as released (simplified)', sanitizeForLog({
        bookingId,
        vendorId: vendor._id,
        amount: booking.vendorAmount,
      }));

      return booking;
    } catch (error) {
      logger.error('Release payment failed', sanitizeForLog({ 
        error: error.message, 
        bookingId 
      }));
      throw error;
    }
  }

  /**
   * Get payment details for a booking
   */
  async getPaymentDetails(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('patient provider');

      if (!booking) {
        throw new Error('Booking not found');
      }

      const paymentDetails = {
        bookingId: booking._id,
        amount: booking.amount,
        commission: booking.commission,
        vendorAmount: booking.vendorAmount,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        // razorpayOrderId: booking.razorpayOrderId,
        // razorpayPaymentId: booking.razorpayPaymentId,
        // razorpayPayoutId: booking.razorpayPayoutId,
        payoutReleasedAt: booking.payoutReleasedAt,
      };

      return paymentDetails;
    } catch (error) {
      logger.error('Get payment details failed', sanitizeForLog({ 
        error: error.message, 
        bookingId 
      }));
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
