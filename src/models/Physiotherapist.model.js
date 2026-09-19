import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const PhysiotherapistServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      default: 45,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const PhysiotherapistSchema = new mongoose.Schema(
  {
    specializations: {
      type: [String],
      default: [
        "Orthopedic Physiotherapy",
        "Sports Injury Rehabilitation",
        "Neurological Rehabilitation",
        "Geriatric Care & Mobility",
        "Post-Surgical Rehabilitation",
        "Spine & Back Pain Relief",
      ],
    },

    qualifications: {
      type: [String],
      default: ["BPT (Bachelor of Physiotherapy)"],
    },

    experience: {
      type: Number, // years
      required: true,
      default: 3,
      min: 0,
    },

    sessionFee: {
      type: Number,
      required: true,
      default: 500,
      min: 0,
    },

    homeVisitAvailable: {
      type: Boolean,
      default: true,
    },

    clinicAddress: {
      type: String,
      trim: true,
    },

    licenseNumber: {
      type: String,
      trim: true,
    },

    servicesOffered: {
      type: [PhysiotherapistServiceSchema],
      default: [],
    },

    about: {
      type: String,
      trim: true,
    },

    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },

    totalPatientsTreated: {
      type: Number,
      default: 0,
      min: 0,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Physiotherapist = User.discriminator(
  "Physiotherapist",
  PhysiotherapistSchema,
  UserRole.PHYSIOTHERAPIST
);
