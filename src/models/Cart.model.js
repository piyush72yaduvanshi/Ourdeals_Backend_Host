import mongoose from "mongoose";

const CartItemSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    mrp: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    stock: {
      type: Number,
      default: 100,
    },
    packSize: {
      type: String,
    },
  },
  { _id: true }
);

const CartSchema = new mongoose.Schema(
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
    items: [CartItemSchema],
    totalItems: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

CartSchema.methods.recalculate = function () {
  let subtotal = 0;
  let totalMrp = 0;
  let count = 0;

  this.items.forEach((item) => {
    subtotal += item.price * item.quantity;
    totalMrp += (item.mrp || item.price) * item.quantity;
    count += item.quantity;
  });

  this.totalItems = count;
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.totalDiscount = Math.max(0, Math.round((totalMrp - subtotal) * 100) / 100);
  this.deliveryFee = this.subtotal > 499 || this.items.length === 0 ? 0 : 40; // Free delivery over ₹499
  this.totalAmount = Math.round((this.subtotal + this.deliveryFee) * 100) / 100;
};

CartSchema.pre("save", function () {
  this.recalculate();
});

CartSchema.index({ user: 1, moduleType: 1 }, { unique: true });

export const Cart = mongoose.model("Cart", CartSchema);
