/**
 * Monitoring Routes
 * Health checks and metrics endpoints
 */

import express from 'express';
import { monitoringService } from '../services/monitoring.service.js';
import { cacheService } from '../services/cache.service.js';
import { successResponse } from '../utils/response.util.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Health check endpoint (public)
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.getHealthStatus();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * Detailed metrics (protected - admin only)
 */
router.get('/metrics', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const metrics = monitoringService.getMetrics();
    res.json(successResponse('Metrics fetched', metrics));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Performance report (protected - admin only)
 */
router.get('/performance', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const report = monitoringService.getPerformanceReport();
    res.json(successResponse('Performance report', report));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Cache statistics (protected - admin only)
 */
router.get('/cache/stats', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const stats = cacheService.getStats();
    res.json(successResponse('Cache statistics', stats));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Clear cache (protected - admin only)
 */
router.post('/cache/clear', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    cacheService.clear();
    res.json(successResponse('Cache cleared'));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Reset metrics (protected - admin only)
 */
router.post('/metrics/reset', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    monitoringService.resetMetrics();
    res.json(successResponse('Metrics reset'));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
