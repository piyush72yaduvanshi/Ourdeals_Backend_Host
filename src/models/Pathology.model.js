import mongoose from "mongoose";
import { User } from "./User.model.js";
import { UserRole } from "../types/index.js";

const TestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: [
        // Hematology
        "Complete Blood Count (CBC)",
        "Hemoglobin",
        "Hematocrit",
        "ESR (Erythrocyte Sedimentation Rate)",
        "Peripheral Blood Smear",

        // Sugar / Diabetes
        "Fasting Blood Sugar (FBS)",
        "Post Prandial Blood Sugar (PPBS)",
        "Random Blood Sugar (RBS)",
        "HbA1c",
        "Insulin Levels",

        // Lipid Profile
        "Lipid Profile",
        "Total Cholesterol",
        "HDL Cholesterol",
        "LDL Cholesterol",
        "VLDL Cholesterol",
        "Triglycerides",

        // Liver Function
        "Liver Function Test (LFT)",
        "SGOT (AST)",
        "SGPT (ALT)",
        "Alkaline Phosphatase (ALP)",
        "Serum Bilirubin",
        "Serum Albumin",
        "Serum Globulin",

        // Kidney Function
        "Kidney Function Test (KFT)",
        "Serum Creatinine",
        "Blood Urea",
        "Serum Uric Acid",
        "BUN (Blood Urea Nitrogen)",

        // Thyroid
        "Thyroid Profile",
        "TSH",
        "T3",
        "T4",

        // Electrolytes
        "Serum Electrolytes",
        "Sodium",
        "Potassium",
        "Chloride",
        "Calcium",
        "Magnesium",
        "Phosphorus",

        // Cardiac Markers
        "Troponin I",
        "CK-MB",
        "BNP (B-type Natriuretic Peptide)",

        // Vitamins
        "Vitamin D (25-OH)",
        "Vitamin B12",
        "Folate",

        // Infection / Inflammation
        "C-Reactive Protein (CRP)",
        "Procalcitonin",
        "D-Dimer",

        // Pancreatic
        "Serum Amylase",
        "Serum Lipase",

        // Iron Studies
        "Serum Iron",
        "Ferritin",
        "Total Iron Binding Capacity (TIBC)",
      ],
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    preparationInstructions: {
      type: String,
      trim: true,
    },

    reportDeliveryTime: {
      type: String,
      default: "24hrs",
    },
  },
  { _id: false },
);

const PathologySchema = new mongoose.Schema(
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

    testsOffered: {
      type: [TestSchema],
      default: [],
    },

    homeCollectionAvailable: {
      type: Boolean,
      default: true,
    },

    homeCollectionFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    certifications: {
      type: [String],
      default: [],
    },

    totalTests: {
      type: Number,
      default: 0,
      min: 0,
    },

    operatingHours: {
      open: {
        type: String,
        default: "07:00",
      },
      close: {
        type: String,
        default: "20:00",
      },
    },
  },
  { timestamps: true },
);

export const Pathology = User.discriminator(
  "Pathology",
  PathologySchema,
  UserRole.PATHOLOGY,
);
