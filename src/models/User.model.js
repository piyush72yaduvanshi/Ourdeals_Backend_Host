import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "../types/index.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: [
        "admin",
        "patient",
        "doctor",
        "pharmacist",
        "nurse",
        "ambulance",
        "bloodbank",
        "pathology",
      ],
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid phone number"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "blocked", "active"],
      default: "active",
    },
    profilePicture: {
      type: String,
      default: "",
    },
    
    // Documents for verification (vendors/providers)
    documents: {
      license: String,        // Professional license
      certificate: String,    // Degree/certification
      idProof: String,       // Government ID
      addressProof: String,  // Address verification
      registration: String,  // Business registration
      insurance: String,     // Insurance certificate
      experience: String,    // Experience certificate
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    deviceTokens: {
      type: [String],
      default: [],
      select: false,
    },

    // Document storage (S3 URLs)
    documents: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Razorpay payout details
    razorpayContactId: {
      type: String,
      select: false,
    },

    razorpayFundAccountId: {
      type: String,
      select: false,
    },

    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifsc: String,
      verifiedAt: Date,
    },

    // ENTERPRISE AUTH: Multiple refresh tokens (multi-device support)
    refreshTokens: {
      type: [String],
      default: [],
      select: false, // Never return in queries
    },

    // ENTERPRISE AUTH: Token versioning (invalidate all sessions)
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // ENTERPRISE AUTH: Password reset
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    discriminatorKey: "role",
  },
);

// GEO INDEX: For location-based queries
userSchema.index({ location: "2dsphere" });

// PERFORMANCE INDEXES
// FIXED: Index phone field with unique constraint to prevent duplicates
userSchema.index({ phone: 1 }, { unique: true });
// FIXED: Index status field instead of non-existent isApproved field
userSchema.index({ role: 1, status: 1 });
// REMOVED: rating.average index - rating field doesn't exist in base User schema
// If rating functionality is needed, add rating field to schema first


userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

const EmptyRoleSchema = new mongoose.Schema({}, { timestamps: true });

const Patient = User.discriminator("Patient", EmptyRoleSchema, UserRole.PATIENT);
const Admin = User.discriminator("Admin", EmptyRoleSchema, UserRole.ADMIN);

export { User, Patient, Admin };
