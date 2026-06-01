/**
 * Utility for sanitizing sensitive data from logs and responses
 * CRITICAL SECURITY FIX: Prevent password/token exposure in logs
 */

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'apikey',
  'api_key',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'bearer',
  'razorpay_signature',
  'razorpay_key_secret',
  'aws_secret_access_key',
];

/**
 * Sanitize object by redacting sensitive fields
 */
export const sanitizeForLog = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field is sensitive
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize error object for logging
 */
export const sanitizeError = (error) => {
  if (!error) return error;

  const sanitized = {
    message: error.message,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    sanitized.stack = error.stack;
  }

  return sanitized;
};

/**
 * Sanitize request object for logging
 */
export const sanitizeRequest = (req) => {
  return {
    method: req.method,
    path: req.path,
    query: sanitizeForLog(req.query),
    body: sanitizeForLog(req.body),
    headers: sanitizeForLog(req.headers),
    ip: req.ip,
    userAgent: req.headers?.['user-agent'],
  };
};

/**
 * Mask sensitive string (show first/last few characters)
 */
export const maskString = (str, visibleChars = 4) => {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= visibleChars * 2) return '[REDACTED]';
  
  const start = str.substring(0, visibleChars);
  const end = str.substring(str.length - visibleChars);
  const masked = '*'.repeat(Math.min(str.length - visibleChars * 2, 10));
  
  return `${start}${masked}${end}`;
};

/**
 * Sanitize user object (remove sensitive fields)
 */
export const sanitizeUser = (user) => {
  if (!user) return user;
  
  const sanitized = { ...user };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.refreshTokens;
  delete sanitized.resetPasswordToken;
  delete sanitized.resetPasswordExpire;
  delete sanitized.deviceTokens;
  delete sanitized.razorpayContactId;
  delete sanitized.razorpayFundAccountId;
  
  // Mask sensitive data
  if (sanitized.email) {
    const [local, domain] = sanitized.email.split('@');
    sanitized.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  if (sanitized.phone) {
    sanitized.phone = maskString(sanitized.phone, 2);
  }
  
  return sanitized;
};
