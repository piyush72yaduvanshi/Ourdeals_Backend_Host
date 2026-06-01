import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";


const PharmacistSchema = new mongoose.Schema(
  {
    pharmacyName: {
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

    deliveryTimes: {
      type: [String],
      enum: ['30min', '1hr', 'same_day'],
      default: ['30min', '1hr', 'same_day'],
    },

    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },

    operatingHours: {
      open: {
        type: String,
        default: '08:00',
      },
      close: {
        type: String,
        default: '22:00',
      },
    },
  },
  { timestamps: true }
);

export const Pharmacist = User.discriminator(
  "Pharmacist",
  PharmacistSchema,
  UserRole.PHARMACIST,
);
