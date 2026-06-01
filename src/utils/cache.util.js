import redis from "../config/redis.js";
import { logger } from "./logger.util.js";

const get = async (key) => {
  try {
    if (!redis) {
      logger.warn("Redis not available, skipping cache read");
      return null;
    }

    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached);
  } catch (error) {
    logger.error("Cache get failed", { key, error: error.message });
    return null;
  }
};

const set = async (key, value, ttl = 300) => {
  try {
    if (!redis) {
      logger.warn("Redis not available, skipping cache write");
      return false;
    }

    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);

    logger.debug("Cache set", { key, ttl });
    return true;
  } catch (error) {
    logger.error("Cache set failed", { key, error: error.message });
    return false;
  }
};

const del = async (key) => {
  try {
    if (!redis) {
      logger.warn("Redis not available, skipping cache delete");
      return false;
    }

    await redis.del(key);

    logger.debug("Cache deleted", { key });
    return true;
  } catch (error) {
    logger.error("Cache delete failed", { key, error: error.message });
    return false;
  }
};

const delPattern = async (pattern) => {
  try {
    if (!redis) {
      logger.warn("Redis not available, skipping pattern delete");
      return false;
    }

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug("Cache pattern deleted", { pattern, count: keys.length });
    }

    return true;
  } catch (error) {
    logger.error("Cache pattern delete failed", {
      pattern,
      error: error.message,
    });
    return false;
  }
};

const withCache = (keyGenerator, ttl = 300) => {
  return (fn) => {
    return async (...args) => {
      const key =
        typeof keyGenerator === "function"
          ? keyGenerator(...args)
          : keyGenerator;

      const cached = await get(key);
      if (cached !== null) {
        logger.debug("Cache hit", { key });
        return cached;
      }

      logger.debug("Cache miss", { key });
      const result = await fn(...args);

      await set(key, result, ttl);

      return result;
    };
  };
};

const keys = {
  nearbyServices: (serviceType, lat, lng, radius) =>
    `nearby:${serviceType}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`,

  userProfile: (userId) => `user:${userId}`,

  providerProfile: (providerId) => `provider:${providerId}`,

  providersByRole: (role) => `providers:role:${role}`,

  bookingStats: (userId) => `stats:booking:${userId}`,
};

const invalidateUser = async (userId) => {
  await delPattern(`user:${userId}*`);
  await delPattern(`provider:${userId}*`);
  await delPattern(`stats:*:${userId}*`);
  logger.info("User cache invalidated", { userId });
};

const invalidateLocationCaches = async (serviceType) => {
  await delPattern(`nearby:${serviceType}:*`);
  logger.info("Location caches invalidated", { serviceType });
};

export const cacheUtil = {
  get,
  set,
  del,
  delPattern,
  withCache,
  keys,
  invalidateUser,
  invalidateLocationCaches,
};
