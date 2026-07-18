import { Router } from 'express';
import {
  requestAccountDeletion,
  confirmAccountDeletion,
  deleteAccountImmediately,
  getAccountDeletionStatus,
  cancelAccountDeletion,
} from '../controller/account.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Request account deletion (Step 1)
 * POST /api/v1/account/request-deletion
 * 
 * Returns confirmation token sent to email/SMS
 * Token expires in 24 hours
 */
router.post('/request-deletion', requestAccountDeletion);

/**
 * Confirm account deletion (Step 2)
 * POST /api/v1/account/confirm-deletion
 * 
 * Body: { deletionToken: string }
 * Permanently deletes account and all data
 */
router.post('/confirm-deletion', confirmAccountDeletion);

/**
 * Delete account immediately (without confirmation)
 * DELETE /api/v1/account
 * 
 * Body: { confirmPassword: string }
 * USE WITH CAUTION - No recovery possible
 */
router.delete('/', deleteAccountImmediately);

/**
 * Get account deletion status
 * GET /api/v1/account/deletion-status
 * 
 * Returns: { deletionRequested, deletionPending, expiresAt }
 */
router.get('/deletion-status', getAccountDeletionStatus);

/**
 * Cancel account deletion request
 * POST /api/v1/account/cancel-deletion
 * 
 * Cancels pending deletion request
 */
router.post('/cancel-deletion', cancelAccountDeletion);

export default router;
