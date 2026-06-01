import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const NurseServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    pricePerHour: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const NurseAvailabilitySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String, // e.g. "09:00"
      required: true,
    },

    endTime: {
      type: String, // e.g. "18:00"
      required: true,
    },

    isBooked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const NurseSchema = new mongoose.Schema(
  {
    servicesOffered: {
      type: [NurseServiceSchema],
      default: [],
    },

    certifications: {
      type: [String],
      default: [],
    },

    experience: {
      type: Number, // years
      required: true,
      min: 0,
    },

    availability: {
      type: [NurseAvailabilitySchema],
      default: [],
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    totalVisits: {
      type: Number,
      default: 0,
      min: 0,
    },

    specializations: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export const Nurse = User.discriminator("Nurse", NurseSchema, UserRole.NURSE);
