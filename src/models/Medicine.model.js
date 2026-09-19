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
      validate: {
        validator: function(v) {
          // Allow empty string or valid string, not objects
          return v === null || v === undefined || typeof v === 'string';
        },
        message: 'imageUrl must be a string'
      }
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

    brand: {
      type: String,
      trim: true,
    },

    packSize: {
      type: String,
      trim: true, // e.g. "Strip of 10 tablets", "100ml Bottle"
    },

    mrp: {
      type: Number,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      default: 0,
    },

    frequentlyBoughtTogether: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
      },
    ],

    uses: {
      type: [String],
      default: [],
    },

    sideEffects: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

medicineSchema.pre('save', function () {
  // Sync brand and manufacturer
  if (!this.brand && this.manufacturer) {
    this.brand = this.manufacturer;
  } else if (!this.manufacturer && this.brand) {
    this.manufacturer = this.brand;
  }

  // Sync packSize and packaging
  if (!this.packSize && this.packaging) {
    this.packSize = this.packaging;
  } else if (!this.packaging && this.packSize) {
    this.packaging = this.packSize;
  }

  // Sync mrp and price
  if (this.price !== undefined && this.mrp === undefined) {
    this.mrp = this.price;
  } else if (this.mrp !== undefined && this.price === undefined) {
    this.price = this.mrp;
  }

  // Sync sellingPrice and discountedPrice
  if (this.discountedPrice !== undefined && this.sellingPrice === undefined) {
    this.sellingPrice = this.discountedPrice;
  } else if (this.sellingPrice !== undefined && this.discountedPrice === undefined) {
    this.discountedPrice = this.sellingPrice;
  } else if (this.sellingPrice === undefined && this.discountedPrice === undefined) {
    this.sellingPrice = this.price;
    this.discountedPrice = this.price;
  }

  // Calculate discount percentage
  const basePrice = this.mrp || this.price || 0;
  const currentSellingPrice = this.sellingPrice || this.discountedPrice || basePrice;
  if (basePrice > currentSellingPrice && basePrice > 0) {
    this.discountPercentage = Math.round(((basePrice - currentSellingPrice) / basePrice) * 100);
  } else {
    this.discountPercentage = 0;
  }

  // Sync first image to imageUrl
  if (this.images && this.images.length > 0 && !this.imageUrl) {
    this.imageUrl = this.images[0];
  }
});

/// 🔹 Indexes for performance & search
medicineSchema.index({ pharmacist: 1, isActive: 1 });
medicineSchema.index({ name: 'text', genericName: 'text', brand: 'text', manufacturer: 'text' });

export const Medicine = mongoose.model('Medicine', medicineSchema);
