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
 * AND ADD IST OFFSET TO SAVE CORRECTLY IN UTC DATABASE
 * 
 * @param {String|Date} dateInput - Date input from frontend (assumed IST)
 * @returns {Date} - Date object with IST time correctly stored as UTC
 * 
 * Example:
 * Frontend sends: "2026-07-14T12:00:00" (meaning 12 PM IST)
 * Without fix: Saved as 12:00 UTC in DB → Shows as 5:30 PM IST
 * With fix: Saved as 6:30 UTC in DB → Shows as 12:00 PM IST ✅
 */
export const parseAsIST = (dateInput) => {
  if (!dateInput) return undefined;
  
  if (dateInput instanceof Date) return dateInput;
  
  // If already has timezone info (Z or +/-HH:MM), use as-is
  if (hasTimezoneInfo(dateInput)) {
    return new Date(dateInput);
  }
  
  // NO timezone info → Assume it's IST time
  // Need to subtract IST offset so it saves correctly as UTC
  const date = new Date(dateInput);
  
  // Check if valid
  if (isNaN(date.getTime())) {
    console.error('Invalid date in parseAsIST:', dateInput);
    return undefined;
  }
  
  // When frontend sends "12:00" thinking it's IST,
  // new Date() treats it as local system time (UTC on server)
  // So we need to ADD IST offset (5.5 hours) to store correct time
  // 
  // Example:
  // Frontend wants: 12:00 PM IST
  // new Date("2026-07-14T12:00:00") creates: 12:00 UTC
  // To store as 12:00 IST in UTC: 12:00 - 5:30 = 6:30 UTC ❌ WRONG!
  // Actually: We want DB to store time that SHOWS as 12:00 IST
  // IST = UTC + 5:30, so to store 12:00 IST we store: 6:30 UTC ✅
  
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  
  // Subtract offset so stored UTC time shows correctly in IST
  return new Date(date.getTime() - IST_OFFSET_MS);
};

