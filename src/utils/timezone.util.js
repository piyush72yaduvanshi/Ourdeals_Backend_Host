/**
 * Timezone Utilities
 * Handles IST to UTC conversion for proper scheduling
 */

/**
 * Convert IST time to UTC
 * IST = UTC + 5:30
 * 
 * @param {Date|String} istTime - Time in IST (can be Date object or ISO string)
 * @returns {Date} - UTC Date object
 * 
 * Example:
 * Input:  2024-01-15T14:30:00 (IST = 2:30 PM India time)
 * Output: 2024-01-15T09:00:00Z (UTC = 9:00 AM UTC)
 */
export const convertISTtoUTC = (istTime) => {
  try {
    // Convert to Date object if string
    const date = istTime instanceof Date ? istTime : new Date(istTime);
    
    // Check if valid date
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date provided');
    }
    
    // IST is UTC+5:30 (330 minutes)
    // To convert IST to UTC, subtract 5 hours 30 minutes
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    
    const utcTime = new Date(date.getTime() - IST_OFFSET_MS);
    
    return utcTime;
  } catch (error) {
    console.error('IST to UTC conversion failed:', error.message);
    // Return original time as fallback
    return istTime instanceof Date ? istTime : new Date(istTime);
  }
};

/**
 * Convert UTC time to IST
 * 
 * @param {Date|String} utcTime - Time in UTC
 * @returns {Date} - IST Date object
 */
export const convertUTCtoIST = (utcTime) => {
  try {
    const date = utcTime instanceof Date ? utcTime : new Date(utcTime);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date provided');
    }
    
    // Add 5 hours 30 minutes for IST
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    
    const istTime = new Date(date.getTime() + IST_OFFSET_MS);
    
    return istTime;
  } catch (error) {
    console.error('UTC to IST conversion failed:', error.message);
    return utcTime instanceof Date ? utcTime : new Date(utcTime);
  }
};

/**
 * Format time for Zoom API (requires ISO string with Z suffix for UTC)
 * 
 * @param {Date|String} istTime - Time in IST
 * @returns {String} - ISO string in UTC format for Zoom
 * 
 * Example:
 * Input:  2024-01-15T14:30:00 (IST)
 * Output: 2024-01-15T09:00:00Z (UTC)
 */
export const formatForZoom = (istTime) => {
  const utcDate = convertISTtoUTC(istTime);
  return utcDate.toISOString();
};

/**
 * Check if a date string has timezone information
 * 
 * @param {String} dateString - Date string to check
 * @returns {Boolean} - True if has timezone info
 */
export const hasTimezoneInfo = (dateString) => {
  if (typeof dateString !== 'string') return false;
  
  // Check for Z suffix (UTC) or +/-HH:MM timezone offset
  return /Z$|[+-]\d{2}:\d{2}$/.test(dateString);
};

/**
 * Parse date string assuming IST if no timezone provided
 * 
 * @param {String|Date} dateInput - Date input
 * @returns {Date} - Parsed date
 */
export const parseAsIST = (dateInput) => {
  if (dateInput instanceof Date) return dateInput;
  
  // If already has timezone info, use as-is
  if (hasTimezoneInfo(dateInput)) {
    return new Date(dateInput);
  }
  
  // If no timezone, assume it's IST and parse accordingly
  // Just create Date object - we'll convert when needed
  return new Date(dateInput);
};
