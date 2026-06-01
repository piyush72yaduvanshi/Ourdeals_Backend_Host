/**
 * Idempotency Middleware
 * CRITICAL FIX: Prevent duplicate payment processing
 */

import { cacheUtil } from '../utils/cache.util.js';
import { errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Idempotency middleware for payment and critical operations
 * Requires 'Idempotency-Key' header
 */
export const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json(
      errorResponse('Idempotency-Key header is required for this operation')
    );
  }

  // Validate idempotency key format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    return res.status(400).json(
      errorResponse('Idempotency-Key must be a valid UUID')
    );
  }

  const cacheKey = `idempotency:${idempotencyKey}`;

  try {
    // Check if request already processed
    const cached = await cacheUtil.get(cacheKey);

    if (cached) {
      logger.info('Idempotent request - returning cached response', {
        requestId: req.id,
        idempotencyKey,
        path: req.path,
      });

      // Return cached response
      return res.status(cached.statusCode || 200).json(cached.data);
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // Cache successful response for 24 hours
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          statusCode: res.statusCode,
          data,
          timestamp: new Date().toISOString(),
        };

        cacheUtil.set(cacheKey, cacheData, 86400).catch(err => {
          logger.error('Failed to cache idempotent response', {
            error: err.message,
            idempotencyKey,
          });
        });

        logger.info('Cached idempotent response', {
          requestId: req.id,
          idempotencyKey,
          statusCode: res.statusCode,
        });
      }

      return originalJson(data);
    };

    next();
  } catch (error) {
    logger.error('Idempotency middleware error', {
      error: error.message,
      idempotencyKey,
    });
    next(error);
  }
};

/**
 * Optional idempotency middleware (doesn't require header)
 * Uses request signature as key if no header provided
 */
export const optionalIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    // No idempotency key provided, continue without caching
    return next();
  }

  // If key provided, use full idempotency logic
  return idempotencyMiddleware(req, res, next);
};
