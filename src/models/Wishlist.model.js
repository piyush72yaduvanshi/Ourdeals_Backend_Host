import mongoose from "mongoose";

const WishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "items.productModel",
    },
    productModel: {
      type: String,
      required: true,
      enum: ["HealthyProduct", "Medicine", "PetProduct"],
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const WishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    moduleType: {
      type: String,
      enum: ["healthys", "medicines", "petcare"],
      required: true,
      index: true,
    },
    items: [WishlistItemSchema],
  },
  { timestamps: true }
);

WishlistSchema.index({ user: 1, moduleType: 1 }, { unique: true });

export const Wishlist = mongoose.model("Wishlist", WishlistSchema);
