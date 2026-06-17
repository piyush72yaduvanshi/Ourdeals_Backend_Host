import mongoose from "mongoose";

const SERVICE_TYPES = [
  "doctor",
  "nurse",
  "ambulance",
  "pharmacist",
  "bloodbank",
  "pathology",
  "labtest",
];

const STATUS = [
  "in_cart",        // Added to cart but not yet requested
  "requested",      // Initial state - waiting for provider acceptance
  "accepted",       // One provider accepted
  "packing_medicines", // Provider is packing medicines
  "out_for_delivery",  // Provider is delivering
  "preparing",      // Provider is preparing the order (for pharmacist)
  "ready",          // Order is ready for pickup/delivery (for pharmacist)
  "on_the_way",     // Provider is traveling/delivering
  "reached",        // Provider has reached the location
  "in_progress",    // Service in progress
  "sample_collected", // Pathology sample collected
  "report_uploaded",  // Pathology report uploaded
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

    category: {
      type: String,
      enum: [
        'General Physician',
        'Dermatology',
        'Gynecology',
        'Mental Wellness',
        'Sexology',
        'Stomach & Digestion',
        'Pediatrics',
        'Orthodpedic'
      ],
    },

    patientName: {
      type: String,
      trim: true,
    },

    patientPhone: {
      type: String,
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

    // City & State for city-based vendor matching
    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    hospitalName: {
      type: String,
      trim: true,
    },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },

    unitsRequired: {
      type: Number,
      min: 1,
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
    
    // Prescription-based order fields
    isPrescriptionBased: {
      type: Boolean,
      default: false,
    },
    prescriptionImages: [{
      type: String,
    }],
    offers: [{
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      deliveryTime: {
        type: String, // e.g. "4 Hours"
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }],

    // Lab test details (for labtest service type)
    tests: [{
      name: {
        type: String,
        trim: true,
      },
      price: {
        type: Number,
        min: 0,
      },
    }],

    report: {
      type: String,
    },
    
    reportUploadedAt: {
      type: Date,
    },

    // Nursing care details (for nurse service type)
    nursingCares: [{
      name: {
        type: String,
        trim: true,
      }
    }],

    preferredDate: {
      type: Date,
    },

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

    dropOffLocation: {
      type: String,
      trim: true,
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

    onTheWayAt: {
      type: Date,
    },

    atPickupAt: {
      type: Date,
    },

    atDropAt: {
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

    // Consultation type (for doctor bookings)
    consultationType: {
      type: String,
      enum: ["in-person", "video-call", "phone-call"],
      default: "video-call",
    },

    scheduledTime: {
      type: Date,
    },

    duration: {
      type: Number,
      min: 0,
    },

    // Video consultation fields
    meetingLink: {
      type: String,
      trim: true,
    },

    meetingId: {
      type: String,
      trim: true,
    },

    meetingPassword: {
      type: String,
      trim: true,
    },

    hostLink: {
      type: String,
      trim: true,
    },

    meetingStartTime: {
      type: Date,
    },

    meetingEndTime: {
      type: Date,
    },

    videoCallCompleted: {
      type: Boolean,
      default: false,
    },

    videoCallEndedAt: {
      type: Date,
    },

    // Zoom specific fields
    zoomMeetingId: {
      type: String,
      trim: true,
    },

    zoomMeetingPassword: {
      type: String,
      trim: true,
    },

    zoomJoinUrl: {
      type: String,
      trim: true,
    },

    zoomHostStartUrl: {
      type: String,
      trim: true,
    },

    // Prescription reference
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
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

// Auto-expire bookings after 24 hours if not accepted
RealTimeBookingSchema.pre("save", function () {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
});

export const RealTimeBooking = mongoose.model("RealTimeBooking", RealTimeBookingSchema);
