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

export default router;
