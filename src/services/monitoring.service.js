/**
 * Monitoring Service
 * Tracks system health, performance metrics, and errors
 */

import { logger } from '../utils/logger.util.js';
import mongoose from 'mongoose';

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map(),
      },
      performance: {
        avgResponseTime: 0,
        slowestEndpoint: null,
        slowestTime: 0,
      },
      database: {
        queries: 0,
        slowQueries: 0,
        errors: 0,
      },
      socket: {
        connections: 0,
        events: 0,
        errors: 0,
      },
      errors: [],
      startTime: Date.now(),
    };

    // Track response times
    this.responseTimes = [];
    this.maxResponseTimes = 1000; // Keep last 1000 response times

    logger.info('Monitoring Service initialized');
  }

  /**
   * Track API request
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} statusCode - Response status code
   * @param {number} responseTime - Response time in ms
   */
  trackRequest(method, path, statusCode, responseTime) {
    this.metrics.requests.total++;

    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }

    // Track by endpoint
    const endpoint = `${method} ${path}`;
    const endpointStats = this.metrics.requests.byEndpoint.get(endpoint) || {
      count: 0,
      avgTime: 0,
      errors: 0,
    };

    endpointStats.count++;
    endpointStats.avgTime = 
      (endpointStats.avgTime * (endpointStats.count - 1) + responseTime) / endpointStats.count;

    if (statusCode >= 400) {
      endpointStats.errors++;
    }

    this.metrics.requests.byEndpoint.set(endpoint, endpointStats);

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }

    // Update average response time
    this.metrics.performance.avgResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    // Track slowest endpoint
    if (responseTime > this.metrics.performance.slowestTime) {
      this.metrics.performance.slowestTime = responseTime;
      this.metrics.performance.slowestEndpoint = endpoint;
    }
  }

  /**
   * Track database query
   * @param {number} executionTime - Query execution time in ms
   * @param {boolean} isSlow - Whether query is slow (>100ms)
   */
  trackDatabaseQuery(executionTime, isSlow = false) {
    this.metrics.database.queries++;
    if (isSlow) {
      this.metrics.database.slowQueries++;
      logger.warn(`Slow database query detected: ${executionTime}ms`);
    }
  }

  /**
   * Track database error
   */
  trackDatabaseError() {
    this.metrics.database.errors++;
  }

  /**
   * Track Socket.IO connection
   */
  trackSocketConnection() {
    this.metrics.socket.connections++;
  }

  /**
   * Track Socket.IO event
   */
  trackSocketEvent() {
    this.metrics.socket.events++;
  }

  /**
   * Track Socket.IO error
   */
  trackSocketError() {
    this.metrics.socket.errors++;
  }

  /**
   * Track error
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  trackError(error, context = 'unknown') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
    };

    this.metrics.errors.push(errorInfo);

    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }

    logger.error('Error tracked', errorInfo);
  }

  /**
   * Get system health status
   * @returns {Object} Health status
   */
  async getHealthStatus() {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Calculate error rate
    const errorRate = this.metrics.requests.total > 0
      ? (this.metrics.requests.errors / this.metrics.requests.total * 100).toFixed(2)
      : 0;

    // Memory usage
    const memoryUsage = process.memoryUsage();

    return {
      status: mongoStatus === 'connected' && errorRate < 10 ? 'healthy' : 'degraded',
      uptime: {
        ms: uptime,
        seconds: uptimeSeconds,
        minutes: uptimeMinutes,
        hours: uptimeHours,
        formatted: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
      },
      database: {
        status: mongoStatus,
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
        errors: this.metrics.database.errors,
      },
      api: {
        totalRequests: this.metrics.requests.total,
        successfulRequests: this.metrics.requests.success,
        failedRequests: this.metrics.requests.errors,
        errorRate: `${errorRate}%`,
        avgResponseTime: `${Math.round(this.metrics.performance.avgResponseTime)}ms`,
      },
      socket: {
        connections: this.metrics.socket.connections,
        events: this.metrics.socket.events,
        errors: this.metrics.socket.errors,
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get detailed metrics
   * @returns {Object} Detailed metrics
   */
  getMetrics() {
    const topEndpoints = Array.from(this.metrics.requests.byEndpoint.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.count,
        avgTime: `${Math.round(stats.avgTime)}ms`,
        errors: stats.errors,
      }));

    const slowestEndpoints = Array.from(this.metrics.requests.byEndpoint.entries())
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10)
      .map(([endpoint, stats]) => ({
        endpoint,
        avgTime: `${Math.round(stats.avgTime)}ms`,
        requests: stats.count,
      }));

    return {
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        errors: this.metrics.requests.errors,
        topEndpoints,
        slowestEndpoints,
      },
      performance: {
        avgResponseTime: `${Math.round(this.metrics.performance.avgResponseTime)}ms`,
        slowestEndpoint: this.metrics.performance.slowestEndpoint,
        slowestTime: `${Math.round(this.metrics.performance.slowestTime)}ms`,
      },
      database: this.metrics.database,
      socket: this.metrics.socket,
      recentErrors: this.metrics.errors.slice(-10),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map(),
      },
      performance: {
        avgResponseTime: 0,
        slowestEndpoint: null,
        slowestTime: 0,
      },
      database: {
        queries: 0,
        slowQueries: 0,
        errors: 0,
      },
      socket: {
        connections: 0,
        events: 0,
        errors: 0,
      },
      errors: [],
      startTime: Date.now(),
    };
    this.responseTimes = [];
    logger.info('Metrics reset');
  }

  /**
   * Get performance report
   * @returns {Object} Performance report
   */
  getPerformanceReport() {
    const p50 = this.getPercentile(50);
    const p95 = this.getPercentile(95);
    const p99 = this.getPercentile(99);

    return {
      responseTime: {
        avg: `${Math.round(this.metrics.performance.avgResponseTime)}ms`,
        p50: `${Math.round(p50)}ms`,
        p95: `${Math.round(p95)}ms`,
        p99: `${Math.round(p99)}ms`,
      },
      requests: {
        total: this.metrics.requests.total,
        rps: this.getRequestsPerSecond(),
      },
      database: {
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
        slowQueryRate: this.metrics.database.queries > 0
          ? `${(this.metrics.database.slowQueries / this.metrics.database.queries * 100).toFixed(2)}%`
          : '0%',
      },
    };
  }

  /**
   * Get percentile from response times
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Response time at percentile
   */
  getPercentile(percentile) {
    if (this.responseTimes.length === 0) return 0;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get requests per second
   * @returns {number} Requests per second
   */
  getRequestsPerSecond() {
    const uptimeSeconds = (Date.now() - this.metrics.startTime) / 1000;
    return uptimeSeconds > 0
      ? (this.metrics.requests.total / uptimeSeconds).toFixed(2)
      : 0;
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
