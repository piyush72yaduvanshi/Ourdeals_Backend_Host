/**
 * URL Utilities
 * Helper functions for handling S3 URLs
 */

import { s3Service } from '../services/s3.service.js';

/**
 * Clean S3 URL by removing signed URL parameters
 * @param {String} url - S3 URL (may contain X-Amz-* parameters)
 * @returns {String} - Clean object URL
 */
export const cleanS3Url = (url) => {
  return s3Service.cleanS3Url(url);
};

/**
 * Clean multiple URLs
 * @param {Array<String>} urls - Array of URLs
 * @returns {Array<String>} - Array of clean URLs
 */
export const cleanS3Urls = (urls) => {
  if (!Array.isArray(urls)) return urls;
  return urls.map(url => cleanS3Url(url));
};

/**
 * Clean URLs in an object recursively
 * @param {Object} obj - Object containing URLs
 * @param {Array<String>} urlFields - Fields that contain URLs
 * @returns {Object} - Object with cleaned URLs
 */
export const cleanObjectUrls = (obj, urlFields = []) => {
  if (!obj) return obj;
  
  const cleaned = { ...obj };
  
  // Common URL field names
  const defaultUrlFields = [
    'imageUrl',
    'images',
    'profilePicture',
    'profilePic',
    'fileUrl',
    'documentUrl',
    'prescriptionImages',
    'medicalReports',
    'previousPrescriptions',
    'otherDocuments',
  ];
  
  const fieldsToClean = [...defaultUrlFields, ...urlFields];
  
  for (const field of fieldsToClean) {
    if (cleaned[field]) {
      if (Array.isArray(cleaned[field])) {
        cleaned[field] = cleanS3Urls(cleaned[field]);
      } else if (typeof cleaned[field] === 'string') {
        cleaned[field] = cleanS3Url(cleaned[field]);
      }
    }
  }
  
  return cleaned;
};

/**
 * Clean URLs in an array of objects
 * @param {Array<Object>} items - Array of objects
 * @param {Array<String>} urlFields - Fields that contain URLs
 * @returns {Array<Object>} - Array with cleaned URLs
 */
export const cleanArrayUrls = (items, urlFields = []) => {
  if (!Array.isArray(items)) return items;
  return items.map(item => cleanObjectUrls(item, urlFields));
};
