import mongoose from 'mongoose';

const MedicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  dosage: {
    type: String,
    required: true,
    trim: true,
  },
  frequency: {
    type: String,
    required: true,
    trim: true,
  },
  duration: {
    type: String,
    required: true,
    trim: true,
  },
  instructions: {
    type: String,
    trim: true,
  },
}, { _id: false });

const PrescriptionSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  diagnosis: {
    type: String,
    required: true,
    trim: true,
  },
  medicines: {
    type: [MedicineSchema],
    default: [],
  },
  advice: {
    type: String,
    trim: true,
  },
  followUpDate: {
    type: Date,
  },
  prescriptionFile: {
    type: String, // S3 URL
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
PrescriptionSchema.index({ patient: 1, createdAt: -1 });
PrescriptionSchema.index({ doctor: 1, createdAt: -1 });
PrescriptionSchema.index({ booking: 1 });

export const Prescription = mongoose.model('Prescription', PrescriptionSchema);
