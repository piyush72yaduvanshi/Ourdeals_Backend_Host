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
  "requested",
  "accepted",
  "on_the_way",
  "in_progress",
  "sample_collected", // For pathology bookings
  "processing", // For pathology bookings  
  "report_ready", // For pathology bookings
  "completed",
  "cancelled",
];

const PAYMENT_STATUS = ["pending", "paid", "released", "refunded"];

const BookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for medicine orders - assigned when pharmacist accepts
      index: true,
    },

    serviceType: {
      type: String,
      enum: SERVICE_TYPES,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: STATUS,
      default: "requested",
      index: true,
    },

    scheduledTime: {
      type: Date,
      validate: {
        validator: function (v) {
          return !v || !this.isNew || v >= new Date();
        },
        message: "Scheduled time must be in the future",
      },
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

    duration: {
      type: Number, // minutes
      min: 0,
    },

    location: {
      address: {
        type: String,
        required: false, // Optional for video consultations
        trim: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: false, // Optional for video consultations
        index: "2dsphere",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    price: {
      type: Number,
      required: function() {
        // Price is required for blood bank bookings
        return this.serviceType === 'bloodbank';
      },
      min: 0,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "online"],
      default: "cash",
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

    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
    },

    report: {
      type: String, // report URL
      trim: true,
    },

    consultationType: {
      type: String,
      enum: ["in-person", "video-call", "phone-call"],
      default: "in-person",
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

    reminderSent: {
      type: Boolean,
      default: false,
    },

    timeSlot: {
      start: {
        type: String,
        trim: true,
      },
      end: {
        type: String,
        trim: true,
      },
    },

    isEmergency: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Payment fields
    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    razorpayPayoutId: {
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      min: 0,
    },

    commission: {
      type: Number,
      min: 0,
    },

    vendorAmount: {
      type: Number,
      min: 0,
    },

    payoutReleasedAt: {
      type: Date,
    },

    // Provider location tracking
    providerLocation: {
      latitude: Number,
      longitude: Number,
      lastUpdated: Date,
    },

    // Patient medical documents (uploaded during booking)
    patientDocuments: {
      medicalReports: [{
        fileName: String,
        fileUrl: String,
        originalName: String,
        uploadedAt: { type: Date, default: Date.now },
        fileSize: Number,
        mimeType: String,
      }],
      previousPrescriptions: [{
        fileName: String,
        fileUrl: String,
        originalName: String,
        uploadedAt: { type: Date, default: Date.now },
        fileSize: Number,
        mimeType: String,
      }],
      otherDocuments: [{
        fileName: String,
        fileUrl: String,
        originalName: String,
        description: String,
        uploadedAt: { type: Date, default: Date.now },
        fileSize: Number,
        mimeType: String,
      }],
    },

    // Pathology specific fields
    collectionScheduled: {
      type: Boolean,
      default: false,
    },

    collectionScheduledAt: {
      type: Date,
    },

    collectionNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    reportUploadedAt: {
      type: Date,
    },

    tests: [{
      name: String,
      description: String,
      price: Number,
      preparationInstructions: String,
      reportDeliveryTime: String,
    }],

    // Blood bank specific fields
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },

    unitsRequired: {
      type: Number,
      min: 1,
    },
  },
  { timestamps: true },
);

BookingSchema.index({ patient: 1, createdAt: -1 });
BookingSchema.index({ provider: 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: -1 });
BookingSchema.index({ isEmergency: 1, createdAt: -1 });

BookingSchema.pre("save", function (next) {
  // Validate blood bank specific fields
  if (this.serviceType === 'bloodbank') {
    if (!this.bloodGroup) {
      return next(new Error("Blood group is required for blood bank bookings"));
    }
    if (!this.unitsRequired || this.unitsRequired <= 0) {
      return next(new Error("Units required must be a positive number for blood bank bookings"));
    }
  }

  // start < end
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    return next(new Error("Starttime should be before endtime"));
  }

  // scheduled <= start
  if (
    this.scheduledTime &&
    this.startTime &&
    this.startTime < this.scheduledTime
  ) {
    return next(new Error("Starttime should be after scheduled time"));
  }

  // calculate duration
  if (this.startTime && this.endTime) {
    this.duration = (this.endTime - this.startTime) / (1000 * 60);
  }

  // cancellation rules
  if (this.status === "cancelled" && !this.cancellationReason) {
    return next(
      new Error("Cancellation reason required when booking is cancelled"),
    );
  }

});

export const Booking = mongoose.model("Booking", BookingSchema);
