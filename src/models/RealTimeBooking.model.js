import mongoose from "mongoose";

const SERVICE_TYPES = [
  "doctor",
  "nurse",
  "ambulance",
  "pharmacist",
  "bloodbank",
  "pathology",
];

const STATUS = [
  "requested",      // Initial state - waiting for provider acceptance
  "accepted",       // One provider accepted
  "preparing",      // Provider is preparing the order (for pharmacist)
  "ready",          // Order is ready for pickup/delivery (for pharmacist)
  "on_the_way",     // Provider is traveling/delivering
  "in_progress",    // Service in progress
  "completed",      // Service completed
  "cancelled",      // Cancelled by patient or system
  "expired",        // No provider accepted within time limit
];

const RealTimeBookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    acceptedProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    serviceType: {
      type: String,
      enum: SERVICE_TYPES,
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: STATUS,
      default: "requested",
      index: true,
    },

    requirements: {
      description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000,
      },
      urgency: {
        type: String,
        enum: ["low", "medium", "high", "emergency"],
        default: "medium",
      },
      preferredTime: {
        type: Date,
      },
      specialRequirements: {
        type: String,
        trim: true,
        maxlength: 500,
      },
    },

    // Medicine order details (for pharmacist service type)
    medicines: [{
      medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Medicine",
      },
      name: {
        type: String,
        trim: true,
      },
      quantity: {
        type: Number,
        min: 1,
      },
      price: {
        type: Number,
        min: 0,
      },
    }],

    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        index: "2dsphere",
      },
    },

    notifiedProviders: [{
      provider: {
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
      viewedAt: {
        type: Date,
      },
    }],

    acceptedAt: {
      type: Date,
    },

    startTime: {
      type: Date,
    },

    endTime: {
      type: Date,
    },

    estimatedArrival: {
      type: Date,
    },

    price: {
      type: Number,
      min: 0,
    },

    totalAmount: {
      type: Number,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    expiresAt: {
      type: Date,
    },

    isEmergency: {
      type: Boolean,
      default: false,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { 
    timestamps: true,
  }
);

// Compound indexes for efficient queries
RealTimeBookingSchema.index({ patient: 1, status: 1, createdAt: -1 });
RealTimeBookingSchema.index({ acceptedProvider: 1, status: 1, createdAt: -1 });
RealTimeBookingSchema.index({ status: 1, expiresAt: 1 });
RealTimeBookingSchema.index({ serviceType: 1, status: 1, createdAt: -1 });
RealTimeBookingSchema.index({ "notifiedProviders.provider": 1, status: 1 });

// FIXED: TTL index for automatic expiration of old bookings
RealTimeBookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Auto-expire bookings after 15 minutes if not accepted
RealTimeBookingSchema.pre("save", function () {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
});

export const RealTimeBooking = mongoose.model("RealTimeBooking", RealTimeBookingSchema);
