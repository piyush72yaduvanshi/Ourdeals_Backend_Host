import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const LabTestSchema = new mongoose.Schema(
  {
    labName: {
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
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    labMobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export const LabTest = User.discriminator(
  "LabTest",
  LabTestSchema,
  UserRole.LABTEST,
);
