/**
 * Monitoring Middleware
 * Tracks API requests and performance
 */

import { monitoringService } from '../services/monitoring.service.js';

/**
 * Request monitoring middleware
 */
export const requestMonitoring = (req, res, next) => {
  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to track response
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Track request
    monitoringService.trackRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      responseTime
    );

    // Log slow requests (>1000ms)
    if (responseTime > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
    }

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
};

/**
 * Error tracking middleware
 */
export const errorTracking = (err, req, res, next) => {
  // Track error
  monitoringService.trackError(err, `${req.method} ${req.path}`);
  
  // Pass to next error handler
  next(err);
};
