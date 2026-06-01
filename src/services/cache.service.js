/**
 * Cache Service
 * In-memory caching for frequently accessed data
 * Can be extended to use Redis in production
 */

import { logger } from '../utils/logger.util.js';

class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
    
    logger.info('Cache Service initialized (in-memory mode)');
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null
   */
  get(key) {
    // Check if key exists and not expired
    if (this.cache.has(key)) {
      const ttl = this.ttlMap.get(key);
      if (ttl && Date.now() > ttl) {
        // Expired, remove it
        this.delete(key);
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return this.cache.get(key);
    }
    
    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
   */
  set(key, value, ttl = 300) {
    this.cache.set(key, value);
    
    if (ttl > 0) {
      this.ttlMap.set(key, Date.now() + (ttl * 1000));
    }
    
    this.stats.sets++;
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.ttlMap.delete(key);
    this.stats.deletes++;
  }

  /**
   * Delete all keys matching pattern
   * @param {string} pattern - Pattern to match (supports wildcards)
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    if (this.cache.has(key)) {
      const ttl = this.ttlMap.get(key);
      if (ttl && Date.now() > ttl) {
        this.delete(key);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.ttlMap.clear();
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, ttl] of this.ttlMap.entries()) {
      if (now > ttl) {
        this.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cache cleanup: ${cleaned} expired entries removed`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  /**
   * Get or set pattern (cache-aside)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not in cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetchFn, ttl = 300) {
    // Try to get from cache
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Not in cache, fetch data
    const data = await fetchFn();
    
    // Store in cache
    this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Cache nearby providers (common query)
   * @param {string} serviceType - Service type
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {Array} data - Provider data
   * @param {number} ttl - Time to live (default: 60 seconds)
   */
  cacheNearbyProviders(serviceType, lat, lng, data, ttl = 60) {
    // Round coordinates to 2 decimal places for cache key
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    const key = `nearby:${serviceType}:${roundedLat}:${roundedLng}`;
    
    this.set(key, data, ttl);
  }

  /**
   * Get cached nearby providers
   * @param {string} serviceType - Service type
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Array|null}
   */
  getNearbyProviders(serviceType, lat, lng) {
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    const key = `nearby:${serviceType}:${roundedLat}:${roundedLng}`;
    
    return this.get(key);
  }

  /**
   * Cache user profile
   * @param {string} userId - User ID
   * @param {Object} data - User data
   * @param {number} ttl - Time to live (default: 300 seconds)
   */
  cacheUserProfile(userId, data, ttl = 300) {
    this.set(`user:${userId}`, data, ttl);
  }

  /**
   * Get cached user profile
   * @param {string} userId - User ID
   * @returns {Object|null}
   */
  getUserProfile(userId) {
    return this.get(`user:${userId}`);
  }

  /**
   * Invalidate user cache
   * @param {string} userId - User ID
   */
  invalidateUser(userId) {
    this.delete(`user:${userId}`);
  }

  /**
   * Cache booking details
   * @param {string} bookingId - Booking ID
   * @param {Object} data - Booking data
   * @param {number} ttl - Time to live (default: 120 seconds)
   */
  cacheBooking(bookingId, data, ttl = 120) {
    this.set(`booking:${bookingId}`, data, ttl);
  }

  /**
   * Get cached booking
   * @param {string} bookingId - Booking ID
   * @returns {Object|null}
   */
  getBooking(bookingId) {
    return this.get(`booking:${bookingId}`);
  }

  /**
   * Invalidate booking cache
   * @param {string} bookingId - Booking ID
   */
  invalidateBooking(bookingId) {
    this.delete(`booking:${bookingId}`);
  }
}

// Export singleton instance
export const cacheService = new CacheService();
