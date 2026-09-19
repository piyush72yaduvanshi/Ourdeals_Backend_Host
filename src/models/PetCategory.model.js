import mongoose from "mongoose";

const PetCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      trim: true,
    },
    targetPets: {
      type: [String],
      enum: ["dog", "cat", "birds", "small_pets", "all"],
      default: ["all"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PetCategorySchema.pre("save", function () {
  if (this.name && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
});

export const PetCategory = mongoose.model("PetCategory", PetCategorySchema);
