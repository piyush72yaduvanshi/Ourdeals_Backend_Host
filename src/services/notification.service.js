import { Notification } from "../models/Notification.model.js";
import { User } from "../models/User.model.js";
import { logger } from "../utils/logger.util.js";
import { addNotificationToQueue } from "../queue/notification.queue.js";
import { NOTIFICATION_TYPES } from "../utils/notificationTemplates.js";
import { sendPushNotification } from "./firebase.service.js";

export const NotificationType = {
  BOOKING_CONFIRMATION: "booking_confirmation",
  BOOKING_ACCEPTED: "booking_accepted",
  PROVIDER_ARRIVING: "provider_arriving",
  EMERGENCY_TRIGGERED: "emergency_triggered",
  PRESCRIPTION_UPLOADED: "prescription_uploaded",
  REPORT_READY: "report_ready",
  MEDICINE_ORDER_REQUEST: "medicine_order_request",
};

const send = async (notificationData) => {
  try {
    await Notification.create({
      recipient: notificationData.recipient,
      sender: notificationData.sender,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
    });

    if (notificationData.sendPush !== false) {
      await sendPush(
        notificationData.recipient,
        notificationData.title,
        notificationData.message,
        notificationData.data,
      );
    }

    if (notificationData.sendSMS === true) {
      await sendSMS(notificationData.recipient, notificationData.message);
    }

    logger.info(`Notification sent to user ${notificationData.recipient}`);
  } catch (error) {
    logger.error("Failed to send notification", {
      error: error.message,
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
      // SQS disabled, deliver push directly via Firebase/AWS SNS to user device tokens!
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

const sendSMS = async (userId, message) => {
  try {
    await addNotificationToQueue(NOTIFICATION_TYPES.SMS, {
      userId,
      message,
    });
    logger.info(`SMS enqueued for user ${userId}`);
  } catch (error) {
    logger.error("Failed to enqueue SMS", {
      error: error.message,
    });
  }
};

const formatServiceTitle = (serviceType, baseTitle) => {
  if (!serviceType) return baseTitle;
  const s = serviceType.toLowerCase();
  if (s.contains ? s.contains('doctor') : s.includes('doctor')) return `Doctor Consultation - ${baseTitle}`;
  if (s.contains ? s.contains('nurse') : s.includes('nurse')) return `Nurse Service - ${baseTitle}`;
  if (s.contains ? s.contains('ambulance') : s.includes('ambulance')) return `Ambulance Service - ${baseTitle}`;
  if (s.contains ? s.contains('pharma') : s.includes('pharma') || s.includes('medicine')) return `Medicine Order - ${baseTitle}`;
  if (s.contains ? s.contains('lab') : s.includes('lab') || s.includes('pathology')) return `Lab Test - ${baseTitle}`;
  if (s.contains ? s.contains('blood') : s.includes('blood')) return `Blood Bank - ${baseTitle}`;
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
  });

const sendPrescriptionUploaded = async (patientId, doctorId) =>
  send({
    recipient: patientId,
    sender: doctorId,
    type: NotificationType.PRESCRIPTION_UPLOADED,
    title: "Prescription Ready",
    message: "Your doctor has uploaded your prescription.",
    sendPush: true,
  });

const sendReportReady = async (patientId, labId) =>
  send({
    recipient: patientId,
    sender: labId,
    type: NotificationType.REPORT_READY,
    title: "Report Ready",
    message: "Your test report is ready for download.",
    sendPush: true,
  });

const sendCollectionScheduled = async (patientId, labId, collectionTime) =>
  send({
    recipient: patientId,
    sender: labId,
    type: "collection_scheduled",
    title: "Sample Collection Scheduled",
    message: `Your sample collection has been scheduled for ${new Date(collectionTime).toLocaleDateString()} at ${new Date(collectionTime).toLocaleTimeString()}.`,
    data: { 
      collectionTime,
      labId,
    },
    sendPush: true,
  });

const sendBookingCompleted = async (patientId, bookingId) =>
  send({
    recipient: patientId,
    type: "booking_update",
    title: "Booking Completed",
    message: "Your booking has been completed. Thank you!",
    data: { bookingId },
    sendPush: true,
  });

const sendBookingCancelled = async (userId, bookingId, reason) =>
  send({
    recipient: userId,
    type: "booking_update",
    title: "Booking Cancelled",
    message: reason
      ? `Booking cancelled: ${reason}`
      : "Your booking has been cancelled.",
    data: { bookingId },
    sendPush: true,
  });

const sendMeetingReminder = async (userId, meetingDetails) =>
  send({
    recipient: userId,
    type: "meeting_reminder",
    title: "Meeting Starting Soon",
    message: `Your video consultation is starting in 15 minutes. Click to join.`,
    data: {
      bookingId: meetingDetails.bookingId,
      meetingLink: meetingDetails.meetingLink,
      scheduledTime: meetingDetails.scheduledTime,
    },
    sendPush: true,
    sendSMS: true,
  });

const sendPrescriptionAvailable = async (patientId, prescriptionId) =>
  send({
    recipient: patientId,
    type: "prescription_available",
    title: "Prescription Available",
    message: "Your doctor has uploaded your prescription. You can now view and download it.",
    data: { prescriptionId },
    sendPush: true,
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
  // Auto-delete notifications older than 24 hours (1 day)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await Notification.deleteMany({
      recipient: userId,
      createdAt: { $lt: oneDayAgo }
    });
  } catch (cleanErr) {
    logger.error('Failed to auto-clean old notifications', { error: cleanErr.message });
  }

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
  // Auto-delete notifications older than 24 hours (1 day)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await Notification.deleteMany({
      recipient: userId,
      createdAt: { $lt: oneDayAgo }
    });
  } catch (cleanErr) {}

  return Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
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
        type: 'nurse_request',
        title: 'New Nursing Service Request',
        message: `New nursing service request: ${requestDetails.serviceType} for ${requestDetails.duration} day(s) - ₹${requestDetails.totalAmount}`,
        data: { 
          bookingId,
          requestDetails,
        },
        sendPush: true,
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
        type: 'lab_test_request',
        title: 'New Lab Test Request',
        message: `New lab test request: ${testDetails.testCount} test(s) - Total: ₹${testDetails.totalAmount}`,
        data: { 
          bookingId,
          testDetails,
        },
        sendPush: true,
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
  sendPush,
  sendSMS,
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
};
