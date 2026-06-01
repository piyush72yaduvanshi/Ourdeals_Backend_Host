import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const AmbulanceSchema = new mongoose.Schema(
  {
    driverName: {
      type: String,
      required: true,
      trim: true,
    },

    driverLicense: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    vehicleType: {
      type: String,
      enum: ["Basic", "Advanced Life Support", "ICU Ambulance"],
      required: true,
    },

    equipmentAvailable: {
      type: [String],
      default: [],
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    totalRides: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Geo index for nearby ambulance search
AmbulanceSchema.index({ currentLocation: "2dsphere" });

// Create discriminator model
export const Ambulance = User.discriminator(
  "Ambulance",
  AmbulanceSchema,
  UserRole.AMBULANCE,
);
