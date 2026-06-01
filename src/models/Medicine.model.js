import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional - will be assigned when order is accepted
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    genericName: {
      type: String,
      trim: true,
    },

    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    dosageForm: {
      type: String,
      required: true,
      trim: true, // tablet, syrup, injection
    },

    strength: {
      type: String,
      trim: true, // 500mg, 10ml
    },

    packaging: {
      type: String,
      trim: true, // strip, bottle
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountedPrice: {
      type: Number,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    requiresPrescription: {
      type: Boolean,
      default: false,
    },

    expiryDate: {
      type: Date,
    },

    imageUrl: {
      type: String,
      trim: true,
    },

    // Support multiple images (1-5)
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 5;
        },
        message: 'Maximum 5 images allowed'
      }
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/// 🔹 Indexes for performance & search
medicineSchema.index({ pharmacist: 1, isActive: 1 });
medicineSchema.index({ name: 'text', genericName: 'text' });

export const Medicine = mongoose.model('Medicine', medicineSchema);
