import { Router } from 'express';
import {
  getAllMedicines,
  getMedicineById,
  getCategories,
  checkAvailability,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
  adminCreateMedicineCategory,
  adminUpdateMedicineCategory,
  adminDeleteMedicineCategory,
} from '../controller/medicine.controller.js';
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
  createOrderController,
  getOrderHistoryController,
  getOrderByIdController,
  cancelOrderController,
  adminGetAllOrdersController,
  adminUpdateOrderStatusController,
} from '../controller/storeCommerce.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';
import { uploadDocuments, handleUploadError } from '../middleware/s3Upload.middleware.js';

const router = Router();
const MODULE_TYPE = 'medicines';

// 1. Public catalog & search
router.get('/', getAllMedicines);
router.get('/categories', getCategories);
router.post('/check-availability', checkAvailability);

// 2. Cart management
router.get('/cart', authenticate, getCartController(MODULE_TYPE));
router.post('/cart', authenticate, addToCartController(MODULE_TYPE));
router.put('/cart/:itemId', authenticate, updateCartItemController(MODULE_TYPE));
router.delete('/cart/:itemId', authenticate, removeCartItemController(MODULE_TYPE));
router.delete('/cart', authenticate, clearCartController(MODULE_TYPE));

// 3. Order management
router.post('/orders', authenticate, createOrderController(MODULE_TYPE));
router.get('/orders', authenticate, getOrderHistoryController(MODULE_TYPE));
router.get('/orders/:orderId', authenticate, getOrderByIdController);
router.post('/orders/:orderId/cancel', authenticate, cancelOrderController);

// Product details by ID (must be after /cart and /orders)
router.get('/:id', getMedicineById);

// 4. Admin / Pharmacist Medicine management
router.post(
  '/', 
  authenticate, 
  authorize(['admin', 'pharmacist']), 
  uploadDocuments.multiple('images', 5),
  handleUploadError,
  addMedicine
);
router.put(
  '/:id', 
  authenticate, 
  authorize(['admin', 'pharmacist']), 
  uploadDocuments.multiple('images', 5),
  handleUploadError,
  updateMedicine
);
router.delete('/:id', authenticate, authorize(['admin', 'pharmacist']), deleteMedicine);
router.patch('/:id/stock', authenticate, authorize(['admin', 'pharmacist']), updateStock);

// 5. Category Management (Admin / Pharmacist)
router.post(
  '/admin/categories',
  authenticate,
  authorize(['admin', 'pharmacist']),
  adminCreateMedicineCategory
);
router.put(
  '/admin/categories/:id',
  authenticate,
  authorize(['admin', 'pharmacist']),
  adminUpdateMedicineCategory
);
router.delete(
  '/admin/categories/:id',
  authenticate,
  authorize(['admin', 'pharmacist']),
  adminDeleteMedicineCategory
);

// 6. Admin / Pharmacist Store Orders Management
router.get(
  '/admin/orders',
  authenticate,
  authorize(['admin', 'pharmacist']),
  adminGetAllOrdersController(MODULE_TYPE)
);
router.patch(
  '/admin/orders/:orderId/status',
  authenticate,
  authorize(['admin', 'pharmacist']),
  adminUpdateOrderStatusController
);

// 7. Legacy Delivery tracking routes (pharmacist only)
router.patch('/order/:bookingId/delivery-status', authenticate, authorize(['pharmacist']), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { deliveryStatus, deliveryTrackingId, deliveryPartner, estimatedDeliveryTime, deliveryNotes } = req.body;
    
    const { Booking } = await import('../models/Booking.model.js');
    
    const booking = await Booking.findOne({
      _id: bookingId,
      serviceType: 'pharmacist',
      provider: req.user.userId,
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Medicine order not found' });
    }

    if (deliveryStatus) booking.deliveryStatus = deliveryStatus;
    if (deliveryTrackingId) booking.deliveryTrackingId = deliveryTrackingId;
    if (deliveryPartner) booking.deliveryPartner = deliveryPartner;
    if (estimatedDeliveryTime) booking.estimatedDeliveryTime = estimatedDeliveryTime;
    if (deliveryNotes) booking.deliveryNotes = deliveryNotes;
    
    if (deliveryStatus === 'delivered') {
      booking.actualDeliveryTime = new Date();
      booking.status = 'completed';
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Delivery status updated successfully',
      data: {
        bookingId: booking._id,
        deliveryStatus: booking.deliveryStatus,
        deliveryTrackingId: booking.deliveryTrackingId,
        deliveryPartner: booking.deliveryPartner,
        estimatedDeliveryTime: booking.estimatedDeliveryTime,
        actualDeliveryTime: booking.actualDeliveryTime,
      },
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update delivery status' });
  }
});

export default router;
