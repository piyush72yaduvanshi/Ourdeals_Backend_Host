import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const TimeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String, // e.g. "09:00"
      required: true,
    },
    endTime: {
      type: String, // e.g. "12:00"
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const AvailabilitySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ],
      required: true,
    },
    slots: {
      type: [TimeSlotSchema],
      default: [],
    },
  },
  { _id: false }
);


const DoctorSchema = new mongoose.Schema(
  {
    specialization: {
      type: String,
      required: true,
      trim: true,
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
        'Orthodpedic',
        'Internal Medicine'
      ],
      default: 'General Physician'
    },

    qualifications: {
      type: [String],
      default: [],
    },

    experience: {
      type: Number, // years
      required: true,
      min: 0,
    },

    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },

    // Consultation types offered by doctor
    consultationTypes: {
      type: [String],
      enum: ['video-call', 'audio-call'],
      required: true,
      default: ['video-call'],
    },

    availability: {
      type: [AvailabilitySchema],
      default: [],
    },

    languages: {
      type: [String],
      default: [],
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    about: {
      type: String,
      trim: true,
    },

    totalConsultations: {
      type: Number,
      default: 0,
      min: 0,
    },

    nextAvailableSlot: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const Doctor = User.discriminator("Doctor", DoctorSchema, UserRole.DOCTOR);
