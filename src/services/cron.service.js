import cron from 'node-cron';
import { Booking } from '../models/Booking.model.js';
import { notificationService } from './notification.service.js';
import { logger } from '../utils/logger.util.js';

class CronService {
  /**
   * Start all cron jobs
   */
  start() {
    // Run every minute to check for upcoming meetings
    cron.schedule('* * * * *', async () => {
      await this.sendMeetingReminders();
    });

    logger.info('Cron jobs started');
  }

  /**
   * Send reminders 15 minutes before meeting
   */
  async sendMeetingReminders() {
    try {
      const now = new Date();
      const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);
      const sixteenMinutesLater = new Date(now.getTime() + 16 * 60000);

      // Find bookings scheduled between 15-16 minutes from now
      const upcomingBookings = await Booking.find({
        scheduledTime: {
          $gte: fifteenMinutesLater,
          $lt: sixteenMinutesLater,
        },
        status: 'accepted',
        paymentStatus: 'paid',
        consultationType: 'VIDEO_CALL',
        reminderSent: false,
      }).populate('patient provider');

      for (const booking of upcomingBookings) {
        try {
          // Send reminder to patient
          await notificationService.sendMeetingReminder(
            booking.patient._id,
            {
              bookingId: booking._id.toString(),
              meetingLink: booking.meetingLink,
              doctorName: `${booking.provider.firstName} ${booking.provider.lastName}`,
              scheduledTime: booking.scheduledTime,
            }
          );

          // Send reminder to doctor
          await notificationService.sendMeetingReminder(
            booking.provider._id,
            {
              bookingId: booking._id.toString(),
              meetingLink: booking.hostLink || booking.meetingLink,
              patientName: `${booking.patient.firstName} ${booking.patient.lastName}`,
              scheduledTime: booking.scheduledTime,
            }
          );

          // Mark reminder as sent
          booking.reminderSent = true;
          await booking.save();

          logger.info('Meeting reminder sent', {
            bookingId: booking._id,
            scheduledTime: booking.scheduledTime,
          });
        } catch (error) {
          logger.error('Failed to send meeting reminder', {
            error: error.message,
            bookingId: booking._id,
          });
        }
      }

      if (upcomingBookings.length > 0) {
        logger.info(`Sent ${upcomingBookings.length} meeting reminders`);
      }
    } catch (error) {
      logger.error('Meeting reminder cron failed', { error: error.message });
    }
  }
}

export const cronService = new CronService();
