import { Prescription } from '../models/Prescription.model.js';
import { Booking } from '../models/Booking.model.js';
import { logger } from './logger.util.js';

let isFixRunning = false;
let lastRunTime = 0;
const MIN_RUN_INTERVAL = 2000; // Minimum 2 seconds between runs to avoid overload

/**
 * Auto-fix utility to link unlinked prescriptions to bookings
 * Runs aggressively - every 10 seconds AND on every booking API call
 */
export async function autofixUnlinkedPrescriptions(triggeredBy = 'scheduler') {
  // Prevent concurrent runs
  if (isFixRunning) {
    return;
  }

  // Rate limiting - don't run too frequently
  const now = Date.now();
  if (now - lastRunTime < MIN_RUN_INTERVAL) {
    return;
  }

  isFixRunning = true;
  lastRunTime = now;

  try {
    // Get all prescriptions with booking reference (limit to recent ones for performance)
    const prescriptions = await Prescription.find({ 
      booking: { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
      .select('_id booking')
      .lean();

    if (prescriptions.length === 0) {
      isFixRunning = false;
      return;
    }

    let fixedCount = 0;

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
      logger.info(`✅ Auto-fix [${triggeredBy}]: Fixed ${fixedCount} bookings`);
    }

  } catch (error) {
    logger.error(`❌ Auto-fix [${triggeredBy}] failed:`, error.message);
  } finally {
    isFixRunning = false;
  }
}

/**
 * Schedule aggressive auto-fix (every 10 seconds)
 */
export function scheduleAutofixPrescriptions() {
  // Run immediately on startup
  setTimeout(() => {
    logger.info('🔧 Starting aggressive auto-fix system...');
    autofixUnlinkedPrescriptions('startup');
  }, 5000); // Wait 5 seconds for DB connection

  // Run every 10 seconds (AGGRESSIVE MODE)
  setInterval(() => {
    autofixUnlinkedPrescriptions('10s-cron');
  }, 10 * 1000); // 10 seconds

  logger.info('📅 Aggressive auto-fix scheduler initialized (runs every 10 seconds)');
}
