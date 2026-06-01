import { tokenService } from '../services/token.service.js';
import { User } from '../models/User.model.js';
import { UserStatus } from '../types/index.js';
import { errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';
import { cacheUtil } from '../utils/cache.util.js';

// In-memory cache as fallback when Redis is unavailable
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getFromCache = async (key) => {
  // Try Redis first
  const redisData = await cacheUtil.get(key);
  if (redisData) return redisData;

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  return null;
};

const setInCache = async (key, data, ttl = 300) => {
  // Try Redis
  await cacheUtil.set(key, data, ttl);

  // Also set in memory cache
  memoryCache.set(key, {
    data,
    expiry: Date.now() + (ttl * 1000),
  });
};

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(errorResponse('Access token required'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = tokenService.verifyAccessToken(token);

    // Check cache (Redis or memory)
    const cacheKey = `user:auth:${decoded.userId}`;
    let user = await getFromCache(cacheKey);

    if (!user) {
      // Only query DB if not in cache
      user = await User.findById(decoded.userId)
        .select('tokenVersion status role')
        .lean();

      if (user) {
        await setInCache(cacheKey, user, 300); // Cache for 5 minutes
      }
    }

    if (!user) {
      logger.warn('Auth failed: User not found', {
        requestId: req.id,
        userId: decoded.userId,
      });
      return res.status(401).json(errorResponse('User not found'));
    }

    if (user.status === UserStatus.BLOCKED) {
      logger.warn('Auth failed: User blocked', {
        requestId: req.id,
        userId: decoded.userId,
      });
      return res.status(403).json(errorResponse('Account is blocked'));
    }

    if (!tokenService.validateTokenVersion(decoded.tokenVersion, user.tokenVersion)) {
      logger.warn('Auth failed: Invalid token version', {
        requestId: req.id,
        userId: decoded.userId,
      });
      return res.status(401).json(
        errorResponse('Session expired. Please login again.')
      );
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || user.role,
    };

    next();
  } catch (error) {
    logger.error('Authentication failed', {
      requestId: req.id,
      error: error.message,
    });
    return res.status(401).json(errorResponse(error.message));
  }
};

// Clean up expired memory cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now >= value.expiry) {
      memoryCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = tokenService.verifyAccessToken(token);

      // Also validate token version in optional auth (SECURITY FIX)
      const user = await User.findById(decoded.userId)
        .select('tokenVersion status')
        .lean();

      if (user && 
          user.status !== UserStatus.BLOCKED &&
          tokenService.validateTokenVersion(decoded.tokenVersion, user.tokenVersion)) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };
      }
    }
  } catch (error) {
    logger.debug('Optional auth failed', {
      requestId: req.id,
      error: error.message,
    });
  }

  next();
};
