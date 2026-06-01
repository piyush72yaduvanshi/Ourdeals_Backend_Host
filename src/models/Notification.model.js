import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    type: {
      type: String,
      enum: [
        'booking_confirmation',
        'booking_accepted',
        'booking_update',
        'booking_request',
        'provider_arriving',
        'emergency_triggered',
        'prescription_uploaded',
        'prescription_available',
        'report_ready',
        'payment',
        'emergency', // Keep for backward compatibility
        'reminder',
        'meeting_created',
        'meeting_reminder',
        'system',
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed, // extra payload (bookingId, etc.)
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    isSent: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model(
  'Notification',
  NotificationSchema
);
