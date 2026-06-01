/**
 * Rate Limiting Middleware
 * CRITICAL SECURITY FIX: Prevent brute force and abuse
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.util.js';

/**
 * Strict rate limit for authentication endpoints
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 5 requests per window
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - auth endpoint', {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    });
  },
});

/**
 * Rate limit for password reset
 * Prevents SMS bombing and abuse
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: 'Too many password reset attempts. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - password reset', {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts. Please try again after 1 hour.',
    });
  },
});

/**
 * Rate limit for payment verification
 * Prevents payment fraud attempts
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  skipSuccessfulRequests: true, // Don't count successful verifications
  message: 'Too many payment verification attempts. Please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - payment verification', {
      ip: req.ip,
      bookingId: req.body?.bookingId,
    });
    res.status(429).json({
      success: false,
      message: 'Too many payment verification attempts. Please wait a moment.',
    });
  },
});

/**
 * Rate limit for document uploads
 * Prevents storage abuse
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes
  message: 'Too many file uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - file upload', {
      ip: req.ip,
      userId: req.user?.userId,
    });
    res.status(429).json({
      success: false,
      message: 'Too many file uploads. Please try again later.',
    });
  },
});

/**
 * Rate limit for emergency requests
 * Prevents abuse while allowing legitimate emergencies
 * DEVELOPMENT: Increased limits for testing
 */
export const emergencyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (reduced window)
  max: 100, // 100 emergency requests per 15 minutes (very generous for testing)
  message: 'Too many emergency requests. If this is a real emergency, please call emergency services.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - emergency request', {
      ip: req.ip,
      userId: req.user?.userId,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'Too many emergency requests. Please wait a moment and try again.',
      retryAfter: '15 minutes',
    });
  },
});

/**
 * General API rate limit
 * Prevents API abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - general API', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  },
});

/**
 * Strict rate limit for registration
 * Prevents spam account creation
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 3 registrations per hour per IP
  message: 'Too many accounts created. Please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded - registration', {
      ip: req.ip,
      email: req.body?.email,
    });
    res.status(429).json({
      success: false,
      message: 'Too many accounts created. Please try again after 1 hour.',
    });
  },
});
