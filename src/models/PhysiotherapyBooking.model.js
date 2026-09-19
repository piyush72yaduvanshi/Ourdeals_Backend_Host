import mongoose from "mongoose";

const PHYSIO_BOOKING_STATUS = [
  "requested",        // Patient submitted request, waiting for offers
  "offers_received",  // At least one offer received
  "confirmed",        // Patient confirmed an offer, assigned to physiotherapist
  "in_progress",      // Session started / provider reached
  "completed",        // Session finished
  "cancelled",        // Cancelled by patient or provider
];

const OfferSchema = new mongoose.Schema(
  {
    physiotherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    offerAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedArrival: {
      type: String, // e.g., "30 mins", "Today 4:00 PM"
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const PhysiotherapyBookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    patientName: {
      type: String,
      required: true,
      trim: true,
    },

    patientPhone: {
      type: String,
      required: true,
      trim: true,
    },

    patientAge: {
      type: Number,
      min: 0,
    },

    patientGender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    service: {
      type: String,
      required: true,
      trim: true,
    },

    serviceCategory: {
      type: String,
      trim: true,
      default: "General Physiotherapy",
    },

    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        index: "2dsphere",
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        trim: true,
      },
    },

    scheduledDate: {
      type: Date,
      required: true,
    },

    scheduledTimeSlot: {
      type: String,
      required: true,
      trim: true, // e.g. "10:00 AM - 11:00 AM" or "Morning"
    },

    notes: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: PHYSIO_BOOKING_STATUS,
      default: "requested",
      index: true,
    },

    offers: [OfferSchema],

    assignedPhysiotherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    confirmedOffer: {
      physiotherapist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      offerAmount: Number,
      confirmedAt: Date,
      notes: String,
    },

    notifiedPhysiotherapists: [
      {
        physiotherapist: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notifiedAt: {
          type: Date,
          default: Date.now,
        },
        viewed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    rejectedByPhysiotherapists: [
      {
        physiotherapist: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rejectedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],

    paymentMode: {
      type: String,
      enum: ["pay_on_visit", "direct_payment"],
      default: "pay_on_visit",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },

    cancellationReason: {
      type: String,
      trim: true,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

PhysiotherapyBookingSchema.index({ patient: 1, status: 1, createdAt: -1 });
PhysiotherapyBookingSchema.index({ assignedPhysiotherapist: 1, status: 1 });

export const PhysiotherapyBooking = mongoose.model(
  "PhysiotherapyBooking",
  PhysiotherapyBookingSchema
);
