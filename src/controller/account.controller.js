import { accountDeletionService } from '../services/account-deletion.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Request account deletion (Step 1 - with confirmation)
 * POST /api/v1/account/request-deletion
 */
export const requestAccountDeletion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    logger.info(`Account deletion requested by ${userId} (${userRole})`);

    const result = await accountDeletionService.requestAccountDeletion(userId, userRole);

    res.json(successResponse(result.message, {
      expiresIn: result.expiresIn,
      confirmationRequired: true
    }));

  } catch (error) {
    logger.error('Request deletion failed:', error.message);
    res.status(500).json(errorResponse('Failed to request account deletion', error.message));
  }
};

/**
 * Confirm account deletion (Step 2 - with token)
 * POST /api/v1/account/confirm-deletion
 * Body: { deletionToken: string }
 */
export const confirmAccountDeletion = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deletionToken } = req.body;

    if (!deletionToken) {
      return res.status(400).json(errorResponse('Deletion token is required'));
    }

    logger.info(`Account deletion confirmation attempt by ${userId}`);

    const result = await accountDeletionService.confirmAccountDeletion(userId, deletionToken);

    res.json(successResponse(result.message, {
      deletionReport: result.deletionReport
    }));

  } catch (error) {
    logger.error('Confirm deletion failed:', error.message);
    
    if (error.message === 'Invalid deletion token' || error.message === 'Deletion token expired') {
      return res.status(400).json(errorResponse(error.message));
    }
    
    res.status(500).json(errorResponse('Failed to confirm account deletion', error.message));
  }
};

/**
 * Delete account immediately (without confirmation - USE WITH CAUTION)
 * DELETE /api/v1/account
 * Query: { confirmPassword: string }
 */
export const deleteAccountImmediately = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { confirmPassword } = req.body;

    // Verify password for immediate deletion
    if (!confirmPassword) {
      return res.status(400).json(errorResponse('Password confirmation required'));
    }

    // Import User model to verify password
    const { User } = await import('../models/User.model.js');
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const isPasswordValid = await user.isPasswordCorrect(confirmPassword);
    if (!isPasswordValid) {
      return res.status(401).json(errorResponse('Invalid password'));
    }

    logger.info(`Immediate account deletion by ${userId} (${userRole})`);

    const result = await accountDeletionService.deleteUserAccount(userId, userRole);

    res.json(successResponse(result.message, {
      deletionReport: result.deletionReport
    }));

  } catch (error) {
    logger.error('Immediate deletion failed:', error.message);
    res.status(500).json(errorResponse('Failed to delete account', error.message));
  }
};

/**
 * Get account deletion status
 * GET /api/v1/account/deletion-status
 */
export const getAccountDeletionStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { User } = await import('../models/User.model.js');
    const user = await User.findById(userId).select('deletionRequested deletionTokenExpiry');

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    const status = {
      deletionRequested: user.deletionRequested || false,
      deletionPending: false,
      expiresAt: null
    };

    if (user.deletionRequested && user.deletionTokenExpiry) {
      status.deletionPending = new Date() < user.deletionTokenExpiry;
      status.expiresAt = user.deletionTokenExpiry;
    }

    res.json(successResponse('Deletion status retrieved', status));

  } catch (error) {
    logger.error('Get deletion status failed:', error.message);
    res.status(500).json(errorResponse('Failed to get deletion status', error.message));
  }
};

/**
 * Cancel account deletion request
 * POST /api/v1/account/cancel-deletion
 */
export const cancelAccountDeletion = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { User } = await import('../models/User.model.js');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(errorResponse('User not found'));
    }

    if (!user.deletionRequested) {
      return res.status(400).json(errorResponse('No deletion request found'));
    }

    user.deletionRequested = false;
    user.deletionToken = undefined;
    user.deletionTokenExpiry = undefined;
    await user.save();

    logger.info(`Account deletion cancelled by ${userId}`);

    res.json(successResponse('Account deletion request cancelled'));

  } catch (error) {
    logger.error('Cancel deletion failed:', error.message);
    res.status(500).json(errorResponse('Failed to cancel deletion', error.message));
  }
};
