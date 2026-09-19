import mongoose from "mongoose";

const PetProductSchema = new mongoose.Schema(
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
    petType: {
      type: String,
      enum: ["dog", "cat", "bird", "small_pets", "all"],
      default: "all",
      index: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
      trim: true, // e.g. "1.2 kg", "3 kg bag", "250 ml"
    },
    lifeStage: {
      type: String,
      enum: ["Puppy", "Kitten", "Adult", "Senior", "All Lifestages"],
      default: "All Lifestages",
    },
    rating: {
      type: Number,
      default: 4.7,
      min: 1,
      max: 5,
    },
    keyBenefits: {
      type: [String],
      default: [],
    },
    ingredients: {
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

PetProductSchema.pre("save", function () {
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

PetProductSchema.index({ name: "text", description: "text", brand: "text" });

export const PetProduct = mongoose.model("PetProduct", PetProductSchema);
