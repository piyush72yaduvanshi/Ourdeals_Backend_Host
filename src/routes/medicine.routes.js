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
} from '../controller/medicine.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = Router();

// Public routes (no authentication required)
router.get('/', getAllMedicines);
router.get('/categories', getCategories);
router.get('/:id', getMedicineById);
router.post('/check-availability', checkAvailability);

// Protected routes (admin/pharmacist only)
router.post('/', authenticate, authorize(['admin', 'pharmacist']), addMedicine);
router.put('/:id', authenticate, authorize(['admin', 'pharmacist']), updateMedicine);
router.delete('/:id', authenticate, authorize(['admin', 'pharmacist']), deleteMedicine);
router.patch('/:id/stock', authenticate, authorize(['admin', 'pharmacist']), updateStock);

// Delivery tracking routes (pharmacist only)
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

    // Update delivery status
    if (deliveryStatus) booking.deliveryStatus = deliveryStatus;
    if (deliveryTrackingId) booking.deliveryTrackingId = deliveryTrackingId;
    if (deliveryPartner) booking.deliveryPartner = deliveryPartner;
    if (estimatedDeliveryTime) booking.estimatedDeliveryTime = estimatedDeliveryTime;
    if (deliveryNotes) booking.deliveryNotes = deliveryNotes;
    
    // Set actual delivery time when delivered
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
