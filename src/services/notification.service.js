import { Notification } from "../models/Notification.model.js";
import { User } from "../models/User.model.js";
import { logger } from "../utils/logger.util.js";
import { addNotificationToQueue } from "../queue/notification.queue.js";
import { NOTIFICATION_TYPES } from "../utils/notificationTemplates.js";
import { sendPushNotification } from "./firebase.service.js";
import { smsService } from "./sms.service.js";
import { emailService } from "./email.service.js";

export const NotificationType = {
  BOOKING_CONFIRMATION: "booking_confirmation",
  BOOKING_ACCEPTED: "booking_accepted",
  BOOKING_UPDATE: "booking_update",
  BOOKING_REQUEST: "booking_request",
  PROVIDER_ARRIVING: "provider_arriving",
  EMERGENCY_TRIGGERED: "emergency_triggered",
  PRESCRIPTION_UPLOADED: "prescription_uploaded",
  PRESCRIPTION_AVAILABLE: "prescription_available",
  PRESCRIPTION_READY: "prescription_ready",
  REPORT_READY: "report_ready",
  COLLECTION_SCHEDULED: "collection_scheduled",
  MEETING_CREATED: "meeting_created",
  MEETING_REMINDER: "meeting_reminder",
  MEDICINE_ORDER_REQUEST: "medicine_order_request",
  NURSE_REQUEST: "nurse_request",
  LAB_TEST_REQUEST: "lab_test_request",
  REGISTRATION_SUCCESSFUL: "registration_successful",
  GENERAL: "general",
  SYSTEM: "system",
  PAYMENT: "payment",
  EMERGENCY: "emergency",
  REMINDER: "reminder",
};

/**
 * Send email to a user — enqueue via SQS or fall back to direct delivery
 */
const sendEmailToUser = async (userId, template, templateData) => {
  try {
    const user = await User.findById(userId).select("email firstName lastName");
    if (!user || !user.email) {
      logger.info(`No email found for user ${userId}`);
      return;
    }

    const data = {
      to: user.email,
      template,
      templateData: {
        name: `${user.firstName} ${user.lastName}`.trim() || "User",
        ...templateData,
      },
    };

    const sqsRes = await addNotificationToQueue(NOTIFICATION_TYPES.EMAIL, data);
    if (!sqsRes) {
      // SQS disabled — deliver email directly
      switch (template) {
        case "WELCOME":
          await emailService.sendWelcomeEmail(data.to, data.templateData.name, templateData.role);
          break;
        case "PASSWORD_RESET":
          await emailService.sendPasswordResetEmail(data.to, data.templateData.name, templateData.resetToken);
          break;
        case "BOOKING_CONFIRMATION":
          await emailService.sendBookingConfirmationEmail(data.to, data.templateData.name, templateData);
          break;
        case "PAYMENT_CONFIRMATION":
          await emailService.sendPaymentConfirmationEmail(data.to, data.templateData.name, templateData);
          break;
        case "ACCOUNT_DELETION":
          await emailService.sendAccountDeletionEmail(data.to, data.templateData.name, templateData.confirmationLink);
          break;
        case "MEETING_REMINDER":
          await emailService.sendMeetingReminderEmail(data.to, data.templateData.name, templateData);
          break;
        default:
          logger.warn(`sendEmailToUser: unknown template ${template}`);
      }
      logger.info(`Direct email sent to user ${userId}`);
    } else {
      logger.info(`Email enqueued for user ${userId} (template: ${template})`);
    }
  } catch (error) {
    logger.error("Failed to send email to user", { error: error.message, userId, template });
  }
};

// Cache socket handler reference after first successful retrieval
let _socketHandler = null;

const emitSocketNotification = (recipientId, notification) => {
  try {
    if (!_socketHandler) {
      // Lazy import — socket handler may not be initialized at module load time
      import("../socket/socket.handler.js").then(({ getSocketHandler }) => {
        try {
          _socketHandler = getSocketHandler();
          _socketHandler.emitToUser(recipientId.toString(), "notification:new", {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            isRead: false,
            createdAt: notification.createdAt || new Date(),
          });
        } catch (err) {
          // Socket not initialized yet — this is fine during startup
        }
      }).catch(() => {
        // Module import failed — socket not available
      });
      return;
    }

    _socketHandler.emitToUser(recipientId.toString(), "notification:new", {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: false,
      createdAt: notification.createdAt || new Date(),
    });
  } catch (error) {
    // Socket emission is best-effort — don't break notification flow
    logger.warn("Socket notification emission failed", { error: error.message });
  }
};

const send = async (notificationData) => {
  try {
    // 1. Save to database (In-App notification)
    const notification = await Notification.create({
      recipient: notificationData.recipient,
      sender: notificationData.sender,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
      isSent: true, // Mark as sent since we're actively delivering it
    });

    // 2. Emit real-time Socket.IO event for instant in-app delivery
    emitSocketNotification(notificationData.recipient, notification);

    // 3. Send push notification (AWS SNS)
    if (notificationData.sendPush !== false) {
      await sendPush(
        notificationData.recipient,
        notificationData.title,
        notificationData.message,
        notificationData.data,
      );
    }

    // 4. Send SMS (AWS SNS)
    if (notificationData.sendSMS === true) {
      await sendSMSToUser(notificationData.recipient, notificationData.message);
    }

    // 5. Send Email (AWS SES)
    if (notificationData.sendEmail === true && notificationData.emailTemplate) {
      await sendEmailToUser(
        notificationData.recipient,
        notificationData.emailTemplate,
        notificationData.emailData || {}
      );
    }

    logger.info(`Notification sent to user ${notificationData.recipient}`, {
      type: notificationData.type,
      push: notificationData.sendPush !== false,
      sms: notificationData.sendSMS === true,
    });
  } catch (error) {
    logger.error("Failed to send notification", {
      error: error.message,
      type: notificationData.type,
      recipient: notificationData.recipient,
    });
  }
};

const sendPush = async (userId, title, message, data = {}) => {
  try {
    const sqsRes = await addNotificationToQueue(NOTIFICATION_TYPES.PUSH, {
      userId,
      title,
      message,
      data,
    });

    if (!sqsRes) {
      // SQS disabled, deliver push directly via AWS SNS to user device tokens
      const user = await User.findById(userId).select("deviceTokens");
      if (user && user.deviceTokens && user.deviceTokens.length > 0) {
        await sendPushNotification(user.deviceTokens, title, message, data);
        logger.info(`Direct push notification sent to user ${userId}`);
      } else {
        logger.info(`No registered device tokens found for user ${userId}`);
      }
    } else {
      logger.info(`Push notification enqueued for user ${userId}`);
    }
  } catch (error) {
    logger.error("Failed to send push notification", {
      error: error.message,
    });
  }
};

/**
 * Send SMS to a user — with SQS queue support and direct delivery fallback
 * (mirrors the push notification pattern for consistency)
 */
const sendSMSToUser = async (userId, message) => {
  try {
    const sqsRes = await addNotificationToQueue(NOTIFICATION_TYPES.SMS, {
      userId,
      message,
    });

    if (!sqsRes) {
      // SQS disabled — deliver SMS directly via AWS SNS
      const user = await User.findById(userId).select("phone");
      if (user && user.phone) {
        await smsService.sendSMS(user.phone, message);
        logger.info(`Direct SMS sent to user ${userId}`);
      } else {
        logger.info(`No phone number found for user ${userId}`);
      }
    } else {
      logger.info(`SMS enqueued for user ${userId}`);
    }
  } catch (error) {
    logger.error("Failed to send SMS", {
      error: error.message,
      userId,
    });
  }
};

const formatServiceTitle = (serviceType, baseTitle) => {
  if (!serviceType) return baseTitle;
  const s = serviceType.toLowerCase();
  if (s.includes('doctor')) return `Doctor Consultation - ${baseTitle}`;
  if (s.includes('nurse')) return `Nurse Service - ${baseTitle}`;
  if (s.includes('ambulance')) return `Ambulance Service - ${baseTitle}`;
  if (s.includes('pharma') || s.includes('medicine')) return `Medicine Order - ${baseTitle}`;
  if (s.includes('lab') || s.includes('pathology')) return `Lab Test - ${baseTitle}`;
  if (s.includes('blood')) return `Blood Bank - ${baseTitle}`;
  return baseTitle;
};

const sendBookingConfirmation = async (patientId, bookingDetails) => {
  const serviceType = bookingDetails.serviceType || 'general';
  const displayTitle = formatServiceTitle(serviceType, 'Booking Created');
  return send({
    recipient: patientId,
    type: NotificationType.BOOKING_CONFIRMATION,
    title: displayTitle,
    message: `Your ${serviceType} booking has been created and sent to nearby providers.`,
    data: { bookingId: bookingDetails.id, serviceType },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
    emailTemplate: "BOOKING_CONFIRMATION",
    emailData: { bookingId: bookingDetails.id, serviceType },
  });
};

const sendBookingAccepted = async (patientId, providerId, bookingDetails) => {
  const serviceType = bookingDetails.serviceType || 'general';
  const displayTitle = formatServiceTitle(serviceType, 'Booking Accepted');
  return send({
    recipient: patientId,
    sender: providerId,
    type: NotificationType.BOOKING_ACCEPTED,
    title: displayTitle,
    message: `Your ${serviceType} booking request has been accepted.`,
    data: { bookingId: bookingDetails.id, serviceType },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
    emailTemplate: "BOOKING_CONFIRMATION",
    emailData: { bookingId: bookingDetails.id, serviceType, status: "accepted" },
  });
};

const sendProviderArriving = async (patientId, providerId, eta) =>
  send({
    recipient: patientId,
    sender: providerId,
    type: NotificationType.PROVIDER_ARRIVING,
    title: "Provider Arriving",
    message: `Your provider will arrive in approximately ${eta} minutes.`,
    data: { eta },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendEmergencyAlert = async (userId, emergencyDetails) =>
  send({
    recipient: userId,
    type: NotificationType.EMERGENCY_TRIGGERED,
    title: "Emergency Request Received",
    message: emergencyDetails,
    data: { isEmergency: true },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendPrescriptionUploaded = async (patientId, doctorId) =>
  send({
    recipient: patientId,
    sender: doctorId,
    type: NotificationType.PRESCRIPTION_UPLOADED,
    title: "Prescription Ready",
    message: "Your doctor has uploaded your prescription.",
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendReportReady = async (patientId, labId) =>
  send({
    recipient: patientId,
    sender: labId,
    type: NotificationType.REPORT_READY,
    title: "Report Ready",
    message: "Your test report is ready for download.",
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendCollectionScheduled = async (patientId, labId, collectionTime) =>
  send({
    recipient: patientId,
    sender: labId,
    type: NotificationType.COLLECTION_SCHEDULED,
    title: "Sample Collection Scheduled",
    message: `Your sample collection has been scheduled for ${new Date(collectionTime).toLocaleDateString()} at ${new Date(collectionTime).toLocaleTimeString()}.`,
    data: { 
      collectionTime,
      labId,
    },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendBookingCompleted = async (patientId, bookingId) =>
  send({
    recipient: patientId,
    type: NotificationType.BOOKING_UPDATE,
    title: "Booking Completed",
    message: "Your booking has been completed. Thank you!",
    data: { bookingId },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendBookingCancelled = async (userId, bookingId, reason) =>
  send({
    recipient: userId,
    type: NotificationType.BOOKING_UPDATE,
    title: "Booking Cancelled",
    message: reason
      ? `Booking cancelled: ${reason}`
      : "Your booking has been cancelled.",
    data: { bookingId },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

const sendMeetingReminder = async (userId, meetingDetails) =>
  send({
    recipient: userId,
    type: NotificationType.MEETING_REMINDER,
    title: "Meeting Starting Soon",
    message: `Your video consultation is starting in 15 minutes. Click to join.`,
    data: {
      bookingId: meetingDetails.bookingId,
      meetingLink: meetingDetails.meetingLink,
      scheduledTime: meetingDetails.scheduledTime,
    },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
    emailTemplate: "MEETING_REMINDER",
    emailData: {
      bookingId: meetingDetails.bookingId,
      meetingLink: meetingDetails.meetingLink,
      scheduledTime: meetingDetails.scheduledTime,
    },
  });

const sendPrescriptionAvailable = async (patientId, prescriptionId) =>
  send({
    recipient: patientId,
    type: NotificationType.PRESCRIPTION_AVAILABLE,
    title: "Prescription Available",
    message: "Your doctor has uploaded your prescription. You can now view and download it.",
    data: { prescriptionId },
    sendPush: true,
    sendSMS: true,
    sendEmail: true,
  });

/**
 * Generic notification sender (for backward compatibility)
 * @param {String} userId - Recipient user ID
 * @param {String} type - Notification type
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {Object} data - Additional data
 */
const sendNotification = async (userId, type, title, message, data = {}) => {
  try {
    return await send({
      recipient: userId,
      type: type || 'general',
      title,
      message,
      data,
      sendPush: true,
      sendSMS: true,
      sendEmail: true,
    });
  } catch (error) {
    logger.error('Send notification failed', { error: error.message, userId, type });
    throw error;
  }
};

const markAsRead = async (notificationId) => {
  await Notification.findByIdAndUpdate(notificationId, {
    isRead: true,
    readAt: new Date(),
  });
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
};

const getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "firstName lastName role")
      .lean(),
    Notification.countDocuments({ recipient: userId }),
  ]);

  return { notifications, total };
};

const getUnreadCount = async (userId) => {
  return Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

/**
 * Cleanup old notifications (called by cron service)
 * Deletes notifications older than 24 hours
 */
const cleanupOldNotifications = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      createdAt: { $lt: oneDayAgo },
    });
    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} old notifications`);
    }
  } catch (error) {
    logger.error('Failed to cleanup old notifications', { error: error.message });
  }
};

const sendMedicineOrderToAllPharmacists = async (bookingId, orderDetails) => {
  try {
    // Get all approved pharmacists
    const pharmacists = await User.find({
      role: 'pharmacist',
      status: 'approved',
    }).select('_id');

    // Send notification to all pharmacists
    const notificationPromises = pharmacists.map(pharmacist =>
      send({
        recipient: pharmacist._id,
        type: NotificationType.MEDICINE_ORDER_REQUEST,
        title: 'New Medicine Order',
        message: `New medicine order received. ${orderDetails.itemCount} item(s) - Total: ₹${orderDetails.totalAmount}`,
        data: { 
          bookingId,
          orderDetails,
        },
        sendPush: true,
        sendSMS: true,
        sendEmail: true,
      })
    );

    await Promise.all(notificationPromises);
    logger.info(`Medicine order notifications sent to ${pharmacists.length} pharmacists for booking ${bookingId}`);
  } catch (error) {
    logger.error('Failed to send medicine order notifications', {
      error: error.message,
      bookingId,
    });
  }
};

const sendNurseRequestToAllNurses = async (bookingId, requestDetails) => {
  try {
    // Get all approved nurses
    const nurses = await User.find({
      role: 'nurse',
      status: 'approved',
    }).select('_id');

    // Send notification to all nurses
    const notificationPromises = nurses.map(nurse =>
      send({
        recipient: nurse._id,
        type: NotificationType.NURSE_REQUEST,
        title: 'New Nursing Service Request',
        message: `New nursing service request: ${requestDetails.serviceType} for ${requestDetails.duration} day(s) - ₹${requestDetails.totalAmount}`,
        data: { 
          bookingId,
          requestDetails,
        },
        sendPush: true,
        sendSMS: true,
        sendEmail: true,
      })
    );

    await Promise.all(notificationPromises);
    logger.info(`Nurse request notifications sent to ${nurses.length} nurses for booking ${bookingId}`);
  } catch (error) {
    logger.error('Failed to send nurse request notifications', {
      error: error.message,
      bookingId,
    });
  }
};

const sendLabTestRequestToAllLabs = async (bookingId, testDetails) => {
  try {
    // Get all approved pathology labs
    const labs = await User.find({
      role: 'pathology',
      status: 'approved',
    }).select('_id');

    // Send notification to all labs
    const notificationPromises = labs.map(lab =>
      send({
        recipient: lab._id,
        type: NotificationType.LAB_TEST_REQUEST,
        title: 'New Lab Test Request',
        message: `New lab test request: ${testDetails.testCount} test(s) - Total: ₹${testDetails.totalAmount}`,
        data: { 
          bookingId,
          testDetails,
        },
        sendPush: true,
        sendSMS: true,
        sendEmail: true,
      })
    );

    await Promise.all(notificationPromises);
    logger.info(`Lab test request notifications sent to ${labs.length} labs for booking ${bookingId}`);
  } catch (error) {
    logger.error('Failed to send lab test request notifications', {
      error: error.message,
      bookingId,
    });
  }
};

export const notificationService = {
  send,
  sendNotification,
  sendEmail: sendEmailToUser,
  sendPush,
  sendSMS: sendSMSToUser,
  sendBookingConfirmation,
  sendBookingAccepted,
  sendProviderArriving,
  sendEmergencyAlert,
  sendPrescriptionUploaded,
  sendReportReady,
  sendCollectionScheduled,
  sendBookingCompleted,
  sendBookingCancelled,
  sendMeetingReminder,
  sendPrescriptionAvailable,
  sendMedicineOrderToAllPharmacists,
  sendNurseRequestToAllNurses,
  sendLabTestRequestToAllLabs,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
  getUnreadCount,
  cleanupOldNotifications,
};
