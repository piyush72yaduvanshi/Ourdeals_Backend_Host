import { Prescription } from '../models/Prescription.model.js';
import { Booking } from '../models/Booking.model.js';
import { logger } from './logger.util.js';

/**
 * Auto-fix utility to link unlinked prescriptions to bookings
 * Runs automatically on server start
 */
export async function autofixUnlinkedPrescriptions() {
  try {
    logger.info('🔧 Auto-fix: Checking for unlinked prescriptions...');

    // Get all prescriptions with booking reference
    const prescriptions = await Prescription.find({ booking: { $exists: true, $ne: null } })
      .select('_id booking')
      .lean();

    if (prescriptions.length === 0) {
      logger.info('   No prescriptions found, skipping auto-fix');
      return;
    }

    let fixedCount = 0;
    let alreadyLinkedCount = 0;

    // Import RealTimeBooking dynamically
    const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');

    for (const prescription of prescriptions) {
      const bookingId = prescription.booking;
      const prescriptionId = prescription._id;

      // Check RealTimeBooking first (most common)
      let booking = await RealTimeBooking.findById(bookingId)
        .select('prescription')
        .lean();
      
      let isRealTime = true;
      
      if (!booking) {
        // Try regular Booking
        booking = await Booking.findById(bookingId)
          .select('prescription')
          .lean();
        isRealTime = false;
      }

      if (!booking) {
        // Booking not found, skip
        continue;
      }

      // Check if already linked
      if (booking.prescription && booking.prescription.toString() === prescriptionId.toString()) {
        alreadyLinkedCount++;
        continue;
      }

      // Fix: Link prescription to booking
      if (isRealTime) {
        await RealTimeBooking.findByIdAndUpdate(bookingId, {
          prescription: prescriptionId
        });
      } else {
        await Booking.findByIdAndUpdate(bookingId, {
          prescription: prescriptionId
        });
      }

      fixedCount++;
    }

    if (fixedCount > 0) {
      logger.info(`✅ Auto-fix complete: Fixed ${fixedCount} bookings, ${alreadyLinkedCount} already linked`);
    } else {
      logger.info(`✅ Auto-fix complete: All ${alreadyLinkedCount} bookings already linked`);
    }

  } catch (error) {
    logger.error('❌ Auto-fix failed:', error.message);
    // Don't throw error - server should continue even if auto-fix fails
  }
}

/**
 * Schedule periodic auto-fix (every 1 hour)
 */
export function scheduleAutofixPrescriptions() {
  // Run immediately on startup
  setTimeout(() => {
    autofixUnlinkedPrescriptions();
  }, 5000); // Wait 5 seconds for DB connection

  // Run every 1 hour
  setInterval(() => {
    autofixUnlinkedPrescriptions();
  }, 60 * 60 * 1000); // 1 hour

  logger.info('📅 Auto-fix scheduler initialized (runs every 1 hour)');
}
