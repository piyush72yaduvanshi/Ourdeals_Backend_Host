import { Router } from "express";
import {
  getHealthyCategories,
  getAllHealthyProducts,
  getHealthyProductById,
  adminCreateHealthyCategory,
  adminUpdateHealthyCategory,
  adminDeleteHealthyCategory,
  adminCreateHealthyProduct,
  adminUpdateHealthyProduct,
  adminDeleteHealthyProduct,
} from "../controller/healthy.controller.js";
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
  getWishlistController,
  addToWishlistController,
  removeFromWishlistController,
  createOrderController,
  getOrderHistoryController,
  getOrderByIdController,
  cancelOrderController,
  adminGetAllOrdersController,
  adminUpdateOrderStatusController,
} from "../controller/storeCommerce.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeAdmin } from "../middleware/role.middleware.js";
import { uploadDocuments, handleUploadError } from "../middleware/s3Upload.middleware.js";

const router = Router();
const MODULE_TYPE = "healthys";

// Public routes
router.get("/categories", getHealthyCategories);
router.get("/products", getAllHealthyProducts);
router.get("/products/:id", getHealthyProductById);

// Cart routes
router.get("/cart", authenticate, getCartController(MODULE_TYPE));
router.post("/cart", authenticate, addToCartController(MODULE_TYPE));
router.put("/cart/:itemId", authenticate, updateCartItemController(MODULE_TYPE));
router.delete("/cart/:itemId", authenticate, removeCartItemController(MODULE_TYPE));
router.delete("/cart", authenticate, clearCartController(MODULE_TYPE));

// Wishlist routes
router.get("/wishlist", authenticate, getWishlistController(MODULE_TYPE));
router.post("/wishlist", authenticate, addToWishlistController(MODULE_TYPE));
router.delete("/wishlist/:productId", authenticate, removeFromWishlistController(MODULE_TYPE));

// Order routes
router.post("/orders", authenticate, createOrderController(MODULE_TYPE));
router.get("/orders", authenticate, getOrderHistoryController(MODULE_TYPE));
router.get("/orders/:orderId", authenticate, getOrderByIdController);
router.post("/orders/:orderId/cancel", authenticate, cancelOrderController);

// Admin Category Management
router.post("/admin/categories", authenticate, authorizeAdmin, adminCreateHealthyCategory);
router.put("/admin/categories/:id", authenticate, authorizeAdmin, adminUpdateHealthyCategory);
router.delete("/admin/categories/:id", authenticate, authorizeAdmin, adminDeleteHealthyCategory);

// Admin Product Management
router.post(
  "/admin/products",
  authenticate,
  authorizeAdmin,
  uploadDocuments.multiple("images", 5),
  handleUploadError,
  adminCreateHealthyProduct
);
router.put(
  "/admin/products/:id",
  authenticate,
  authorizeAdmin,
  uploadDocuments.multiple("images", 5),
  handleUploadError,
  adminUpdateHealthyProduct
);
router.delete("/admin/products/:id", authenticate, authorizeAdmin, adminDeleteHealthyProduct);

// Admin Order Management
router.get("/admin/orders", authenticate, authorizeAdmin, adminGetAllOrdersController(MODULE_TYPE));
router.patch("/admin/orders/:orderId/status", authenticate, authorizeAdmin, adminUpdateOrderStatusController);

export default router;
