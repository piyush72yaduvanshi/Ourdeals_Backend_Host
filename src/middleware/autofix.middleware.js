import { autofixUnlinkedPrescriptions } from '../utils/autofix-prescriptions.util.js';

/**
 * Middleware to trigger auto-fix on every booking-related API call
 * Runs asynchronously without blocking the response
 */
export const triggerAutofixMiddleware = (req, res, next) => {
  // Don't block the request - run auto-fix in background
  setImmediate(() => {
    autofixUnlinkedPrescriptions('api-call').catch(err => {
      // Silently fail - don't affect the API response
      console.error('Auto-fix middleware error:', err.message);
    });
  });

  // Continue with the request immediately
  next();
};
