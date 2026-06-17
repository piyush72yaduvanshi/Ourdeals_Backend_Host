import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";


const BloodStockSchema = new mongoose.Schema(
  {
    bloodGroup: {
      type: String,
      enum: [
        'A+',
        'A-',
        'B+',
        'B-',
        'AB+',
        'AB-',
        'O+',
        'O-',
      ],
      required: true,
    },

    unitsAvailable: {
      type: Number,
      required: true,
      min: 0,
    },

    pricePerUnit: {
      type: Number,
      required: true, // REQUIRED during registration
      min: 0,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const BloodBankSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      required: true,
      trim: true,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    inchargeName: {
      type: String,
      required: true,
      trim: true,
    },

    servicesAvailable: {
      type: [String],
      required: true,
      default: [],
    },

    bloodStock: {
      type: [BloodStockSchema],
      default: [],
    },

    emergencyContact: {
      type: String,
      required: true,
      trim: true,
    },

    operatingHours: {
      open: {
        type: String,
        default: '00:00', // 24x7
      },
      close: {
        type: String,
        default: '23:59',
      },
    },

    totalRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export const BloodBank = User.discriminator(
  "BloodBank",
  BloodBankSchema,
  UserRole.BLOOD_BANK,
);
