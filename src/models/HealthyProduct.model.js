import mongoose from "mongoose";

const HealthyProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "Healthys",
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
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
    discountPercentage: {
      type: Number,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    packSize: {
      type: String,
      trim: true, // e.g. "60 capsules", "500g", "250ml"
    },
    rating: {
      type: Number,
      default: 4.6,
      min: 1,
      max: 5,
    },
    benefits: {
      type: [String],
      default: [],
    },
    ingredients: {
      type: [String],
      default: [],
    },
    howToUse: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

HealthyProductSchema.pre("save", function () {
  if (this.price && this.discountedPrice && this.price > this.discountedPrice) {
    this.discountPercentage = Math.round(
      ((this.price - this.discountedPrice) / this.price) * 100
    );
  } else {
    this.discountPercentage = 0;
  }

  if (this.images && this.images.length > 0 && !this.imageUrl) {
    this.imageUrl = this.images[0];
  }
});

HealthyProductSchema.index({ name: "text", description: "text", brand: "text" });

export const HealthyProduct = mongoose.model("HealthyProduct", HealthyProductSchema);
