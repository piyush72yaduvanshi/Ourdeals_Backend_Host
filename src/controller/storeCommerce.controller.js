import { Cart } from "../models/Cart.model.js";
import { Wishlist } from "../models/Wishlist.model.js";
import { StoreOrder } from "../models/StoreOrder.model.js";
import { HealthyProduct } from "../models/HealthyProduct.model.js";
import { Medicine } from "../models/Medicine.model.js";
import { PetProduct } from "../models/PetProduct.model.js";
import { successResponse, errorResponse, paginatedResponse } from "../utils/response.util.js";

// Helper to get corresponding Mongoose model by moduleType
export const getProductModel = (moduleType) => {
  switch (moduleType) {
    case "healthys":
      return { model: HealthyProduct, modelName: "HealthyProduct" };
    case "medicines":
      return { model: Medicine, modelName: "Medicine" };
    case "petcare":
      return { model: PetProduct, modelName: "PetProduct" };
    default:
      throw new Error(`Invalid module type: ${moduleType}`);
  }
};

// ==========================================
// CART HANDLERS
// ==========================================

export const getCartController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    let cart = await Cart.findOne({ user: userId, moduleType });

    if (!cart) {
      cart = new Cart({ user: userId, moduleType, items: [] });
      await cart.save();
    }

    res.json(successResponse("Cart fetched successfully", cart));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const addToCartController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json(errorResponse("productId is required"));
    }

    const { model, modelName } = getProductModel(moduleType);
    const product = await model.findById(productId);

    if (!product || product.isActive === false) {
      return res.status(404).json(errorResponse("Product not found or inactive"));
    }

    if (product.stock < quantity) {
      return res.status(400).json(
        errorResponse(`Only ${product.stock} units available in stock`)
      );
    }

    let cart = await Cart.findOne({ user: userId, moduleType });
    if (!cart) {
      cart = new Cart({ user: userId, moduleType, items: [] });
    }

    const price = product.discountedPrice || product.price || product.sellingPrice || 0;
    const mrp = product.price || product.mrp || price;
    const image = product.imageUrl || (product.images && product.images[0]) || "";
    const name = product.name;
    const packSize = product.packSize || product.packaging || product.weight || "";

    const existingIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (existingIndex >= 0) {
      const newQty = cart.items[existingIndex].quantity + Number(quantity);
      if (newQty > product.stock) {
        return res.status(400).json(
          errorResponse(`Cannot add more than available stock (${product.stock})`)
        );
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].price = price;
      cart.items[existingIndex].mrp = mrp;
    } else {
      cart.items.push({
        productId,
        productModel: modelName,
        name,
        image,
        price,
        mrp,
        quantity: Number(quantity),
        stock: product.stock,
        packSize,
      });
    }

    await cart.save();
    res.json(successResponse("Item added to cart", cart));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const updateCartItemController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || Number(quantity) < 1) {
      return res.status(400).json(errorResponse("Quantity must be at least 1"));
    }

    const cart = await Cart.findOne({ user: userId, moduleType });
    if (!cart) {
      return res.status(404).json(errorResponse("Cart not found"));
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json(errorResponse("Item not found in cart"));
    }

    const { model } = getProductModel(moduleType);
    const product = await model.findById(item.productId);
    if (product && product.stock < Number(quantity)) {
      return res.status(400).json(
        errorResponse(`Requested quantity exceeds available stock (${product.stock})`)
      );
    }

    item.quantity = Number(quantity);
    await cart.save();

    res.json(successResponse("Cart item updated", cart));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const removeCartItemController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId, moduleType });
    if (!cart) {
      return res.status(404).json(errorResponse("Cart not found"));
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId.toString());
    await cart.save();

    res.json(successResponse("Item removed from cart", cart));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const clearCartController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const cart = await Cart.findOne({ user: userId, moduleType });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json(successResponse("Cart cleared", cart || { items: [], totalItems: 0 }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==========================================
// WISHLIST HANDLERS
// ==========================================

export const getWishlistController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    let wishlist = await Wishlist.findOne({ user: userId, moduleType });

    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, moduleType, items: [] });
      await wishlist.save();
    }

    const { model } = getProductModel(moduleType);
    const productIds = wishlist.items.map((i) => i.productId);
    const products = await model.find({ _id: { $in: productIds } }).lean();

    const formatted = wishlist.items.map((item) => {
      const prod = products.find((p) => p._id.toString() === item.productId.toString());
      return {
        wishlistItemId: item._id,
        addedAt: item.addedAt,
        product: prod || null,
      };
    }).filter(item => item.product !== null);

    res.json(successResponse("Wishlist fetched successfully", formatted));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const addToWishlistController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json(errorResponse("productId is required"));
    }

    const { model, modelName } = getProductModel(moduleType);
    const product = await model.findById(productId);
    if (!product) {
      return res.status(404).json(errorResponse("Product not found"));
    }

    let wishlist = await Wishlist.findOne({ user: userId, moduleType });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, moduleType, items: [] });
    }

    const exists = wishlist.items.some(
      (item) => item.productId.toString() === productId.toString()
    );

    if (!exists) {
      wishlist.items.push({
        productId,
        productModel: modelName,
        addedAt: new Date(),
      });
      await wishlist.save();
    }

    res.json(successResponse("Added to wishlist", wishlist));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const removeFromWishlistController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: userId, moduleType });
    if (!wishlist) {
      return res.status(404).json(errorResponse("Wishlist not found"));
    }

    wishlist.items = wishlist.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );
    await wishlist.save();

    res.json(successResponse("Removed from wishlist", wishlist));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==========================================
// ORDER HANDLERS
// ==========================================

export const createOrderController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { shippingAddress, paymentMethod = "cash_on_delivery" } = req.body;

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address) {
      return res.status(400).json(
        errorResponse("Complete shipping address (fullName, phone, address) is required")
      );
    }

    const cart = await Cart.findOne({ user: userId, moduleType });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json(errorResponse("Your cart is empty"));
    }

    const { model } = getProductModel(moduleType);

    // Validate stock and prepare order items
    const orderItems = [];
    for (const item of cart.items) {
      const product = await model.findById(item.productId);
      if (!product || product.isActive === false) {
        return res.status(400).json(
          errorResponse(`Product "${item.name}" is no longer available`)
        );
      }
      if (product.stock < item.quantity) {
        return res.status(400).json(
          errorResponse(`Insufficient stock for "${item.name}". Only ${product.stock} remaining.`)
        );
      }

      orderItems.push({
        productId: item.productId,
        productModel: item.productModel,
        name: item.name,
        image: item.image,
        price: item.price,
        mrp: item.mrp,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        packSize: item.packSize,
      });

      // Decrement stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Generate unique order number
    const prefix = moduleType === "healthys" ? "HLT" : moduleType === "medicines" ? "MED" : "PET";
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${prefix}-${Date.now().toString().slice(-4)}${randomDigits.toString().slice(-3)}`;

    const order = new StoreOrder({
      orderNumber,
      user: userId,
      moduleType,
      items: orderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        city: shippingAddress.city || "New Delhi",
        state: shippingAddress.state || "Delhi",
        pincode: shippingAddress.pincode || "110001",
      },
      subtotal: cart.subtotal,
      discount: cart.totalDiscount,
      deliveryFee: cart.deliveryFee,
      totalAmount: cart.totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "cash_on_delivery" ? "pending" : "paid",
      orderStatus: "placed",
      statusHistory: [
        {
          status: "placed",
          updatedBy: userId,
          timestamp: new Date(),
          notes: "Order placed successfully",
        },
      ],
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    });

    await order.save();

    // Clear user cart
    cart.items = [];
    await cart.save();

    res.status(201).json(
      successResponse("Order placed successfully", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        estimatedDeliveryDate: order.estimatedDeliveryDate,
        itemsCount: order.items.length,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const getOrderHistoryController = (moduleType) => async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (moduleType) query.moduleType = moduleType;
    if (status) query.orderStatus = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      StoreOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      StoreOrder.countDocuments(query),
    ]);

    res.json(paginatedResponse("Orders fetched successfully", orders, Number(page), Number(limit), total));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const getOrderByIdController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await StoreOrder.findById(orderId)
      .populate("user", "firstName lastName phone email")
      .lean();

    if (!order) {
      return res.status(404).json(errorResponse("Order not found"));
    }

    if (
      order.user._id.toString() !== req.user.userId.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "pharmacist"
    ) {
      return res.status(403).json(errorResponse("Unauthorized to view this order"));
    }

    res.json(successResponse("Order details fetched", order));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const cancelOrderController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user.userId;

    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json(errorResponse("Order not found"));
    }

    if (order.user.toString() !== userId.toString() && req.user.role !== "admin") {
      return res.status(403).json(errorResponse("Unauthorized to cancel this order"));
    }

    if (["shipped", "out_for_delivery", "delivered"].includes(order.orderStatus)) {
      return res.status(400).json(
        errorResponse(`Cannot cancel order once it is ${order.orderStatus}`)
      );
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json(errorResponse("Order is already cancelled"));
    }

    // Restore inventory stock
    const { model } = getProductModel(order.moduleType);
    for (const item of order.items) {
      await model.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }

    order.orderStatus = "cancelled";
    order.cancellationReason = cancellationReason || "Cancelled by customer";
    order.cancelledBy = userId;
    order.statusHistory.push({
      status: "cancelled",
      updatedBy: userId,
      timestamp: new Date(),
      notes: order.cancellationReason,
    });

    await order.save();
    res.json(successResponse("Order cancelled successfully", order));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

// ==========================================
// ADMIN ORDER MANAGEMENT
// ==========================================

export const adminGetAllOrdersController = (moduleType) => async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (moduleType) query.moduleType = moduleType;
    if (status) query.orderStatus = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      StoreOrder.find(query)
        .populate("user", "firstName lastName phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      StoreOrder.countDocuments(query),
    ]);

    res.json(paginatedResponse("All orders fetched", orders, Number(page), Number(limit), total));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};

export const adminUpdateOrderStatusController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, deliveryPartner, trackingId, notes } = req.body;

    const allowed = [
      "placed",
      "confirmed",
      "processing",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    if (!orderStatus || !allowed.includes(orderStatus)) {
      return res.status(400).json(
        errorResponse(`Invalid order status. Allowed: ${allowed.join(", ")}`)
      );
    }

    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json(errorResponse("Order not found"));
    }

    order.orderStatus = orderStatus;
    if (deliveryPartner) order.deliveryPartner = deliveryPartner;
    if (trackingId) order.trackingId = trackingId;
    if (orderStatus === "delivered") {
      order.actualDeliveryDate = new Date();
      order.paymentStatus = "paid";
    }

    order.statusHistory.push({
      status: orderStatus,
      updatedBy: req.user.userId,
      timestamp: new Date(),
      notes: notes || `Order marked as ${orderStatus}`,
    });

    await order.save();
    res.json(successResponse(`Order status updated to ${orderStatus}`, order));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
};
