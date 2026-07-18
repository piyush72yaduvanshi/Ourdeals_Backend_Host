import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.util.js';
import fs from 'fs';
import path from 'path';

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'onmint-healthcare';
const USE_S3 = process.env.USE_S3 === 'true'; // Toggle between S3 and local storage

/**
 * Upload file to S3 or local storage
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder name (e.g., 'profile-pictures', 'documents')
 * @param {String} userId - User ID for organizing files
 * @returns {Object} - Object with fileName, fileUrl, originalName
 */
const uploadFile = async (file, folder, userId) => {
  try {
    if (USE_S3) {
      // Upload to S3
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${userId}/${Date.now()}-${sanitizedFilename}`;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer || fs.readFileSync(file.path),
        ContentType: file.mimetype,
      });

      await s3Client.send(command);
      
      // Delete local temp file after successful upload
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          logger.info('Temporary file deleted', { path: file.path });
        }
      } catch (deleteError) {
        logger.warn('Failed to delete temporary file', { 
          path: file.path, 
          error: deleteError.message 
        });
        // Don't throw error, file was uploaded successfully
      }
      
      // Return S3 URL with metadata
      const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      
      logger.info('File uploaded to S3', { key, url });
      
      return {
        fileName: key,
        fileUrl: url,
        originalName: file.originalname,
      };
    } else {
      // Use local storage (already handled by multer)
      const localPath = `/uploads/${file.fieldname}/${file.filename}`;
      logger.info('File stored locally', { path: localPath });
      
      return {
        fileName: file.filename,
        fileUrl: localPath,
        originalName: file.originalname,
      };
    }
  } catch (error) {
    // Clean up temp file on error
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        logger.info('Temporary file deleted after error', { path: file.path });
      }
    } catch (deleteError) {
      logger.warn('Failed to delete temporary file after error', { 
        path: file.path, 
        error: deleteError.message 
      });
    }
    
    logger.error('File upload failed', { error: error.message });
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload multiple files
 * @param {Array} files - Array of multer file objects
 * @param {String} folder - Folder name
 * @param {String} userId - User ID
 * @returns {Array} - Array of objects with fileName, fileUrl, originalName
 */
const uploadMultipleFiles = async (files, folder, userId) => {
  const uploadedFiles = [];
  const failedFiles = [];
  
  try {
    // Upload files one by one to ensure proper cleanup
    for (const file of files) {
      try {
        const result = await uploadFile(file, folder, userId);
        uploadedFiles.push(result);
      } catch (error) {
        logger.error('Failed to upload file', { 
          filename: file.originalname, 
          error: error.message 
        });
        failedFiles.push(file.originalname);
        
        // Clean up temp file if it still exists
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            logger.info('Cleaned up failed upload temp file', { path: file.path });
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file', { 
            path: file.path, 
            error: cleanupError.message 
          });
        }
      }
    }
    
    if (failedFiles.length > 0) {
      logger.warn('Some files failed to upload', { 
        failed: failedFiles, 
        successful: uploadedFiles.length 
      });
    }
    
    if (uploadedFiles.length === 0) {
      throw new Error('All file uploads failed');
    }
    
    return uploadedFiles;
  } catch (error) {
    logger.error('Multiple file upload failed', { error: error.message });
    throw new Error(`Failed to upload files: ${error.message}`);
  }
};

/**
 * Delete file from S3 or local storage
 * @param {String} fileUrl - File URL or path
 * @returns {Boolean} - Success status
 */
const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl) return true;

    if (USE_S3 && fileUrl.includes('amazonaws.com')) {
      // Extract key from S3 URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Remove leading slash
      
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      logger.info('File deleted from S3', { key });
    } else {
      // Delete from local storage
      const localPath = path.join(process.cwd(), 'uploads', fileUrl);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logger.info('File deleted locally', { path: localPath });
      }
    }
    
    return true;
  } catch (error) {
    logger.error('File deletion failed', { error: error.message });
    return false;
  }
};

/**
 * Clean S3 URL by removing any signed URL parameters
 * Converts signed URLs back to standard object URLs
 * @param {String} fileUrl - S3 URL (may contain signed URL parameters)
 * @returns {String} - Clean S3 object URL
 */
const cleanS3Url = (fileUrl) => {
  try {
    if (!fileUrl) return fileUrl;
    
    // If it's a local file path, return as-is
    if (!fileUrl.includes('amazonaws.com')) {
      return fileUrl;
    }
    
    // Parse URL and remove query parameters (X-Amz-* parameters)
    const url = new URL(fileUrl);
    
    // Return clean URL without query parameters
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (error) {
    logger.warn('Failed to clean S3 URL', { error: error.message, fileUrl });
    return fileUrl; // Return original on error
  }
};

/**
 * Upload documents object (multiple document types)
 * @param {Object} files - Object with document types as keys
 * @param {String} userId - User ID
 * @param {String} role - User role (doctor, nurse, pathology, etc.)
 * @returns {Object} - Object with document metadata
 */
const uploadDocuments = async (files, userId, role = 'vendor') => {
  try {
    const documents = {};
    const folder = `documents/${role}/${userId}`;
    
    for (const [fieldName, fileArray] of Object.entries(files)) {
      if (Array.isArray(fileArray) && fileArray.length > 0) {
        if (fileArray.length === 1) {
          // Single file
          const result = await uploadFile(fileArray[0], folder, userId);
          documents[fieldName] = {
            fileName: result.fileName,
            fileUrl: result.fileUrl,
            originalName: result.originalName,
            uploadedAt: new Date(),
            verified: false,
          };
        } else {
          // Multiple files (like photos)
          const results = await uploadMultipleFiles(fileArray, folder, userId);
          documents[fieldName] = results.map(result => ({
            fileName: result.fileName,
            fileUrl: result.fileUrl,
            originalName: result.originalName,
            uploadedAt: new Date(),
            verified: false,
          }));
        }
      }
    }
    
    return documents;
  } catch (error) {
    logger.error('Document upload failed', { error: error.message });
    throw new Error(`Failed to upload documents: ${error.message}`);
  }
};

/**
 * Initialize S3 service (placeholder for any setup needed)
 * @returns {Boolean} - Success status
 */
const initializeS3 = async () => {
  try {
    if (USE_S3) {
      logger.info('S3 service initialized', { 
        bucket: BUCKET_NAME, 
        region: process.env.AWS_REGION || 'us-east-1' 
      });
    } else {
      logger.info('S3 service initialized in local mode');
    }
    
    // Clean up any orphaned temp files on startup
    cleanupTempFiles();
    
    return true;
  } catch (error) {
    logger.error('S3 initialization failed', { error: error.message });
    return false;
  }
};

/**
 * Clean up temporary files in uploads directory
 * Removes files older than 1 hour
 */
const cleanupTempFiles = () => {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return;
    }
    
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
    
    // Recursively clean up old files
    const cleanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          cleanDirectory(filePath);
          
          // Remove empty directories
          const remainingFiles = fs.readdirSync(filePath);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(filePath);
            logger.info('Removed empty directory', { path: filePath });
          }
        } else if (stats.isFile()) {
          // Delete files older than 1 hour
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            logger.info('Cleaned up old temp file', { 
              path: filePath, 
              age: Math.round((now - stats.mtimeMs) / 1000 / 60) + ' minutes' 
            });
          }
        }
      });
    };
    
    cleanDirectory(uploadsDir);
    logger.info('Temp files cleanup completed');
  } catch (error) {
    logger.warn('Temp files cleanup failed', { error: error.message });
  }
};

export const s3Service = {
  initializeS3,
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  cleanS3Url,
  uploadDocuments,
  cleanupTempFiles,
  deleteFolderContents,
  deleteFileByUrl,
};

/**
 * Delete all files in a folder/prefix in S3
 * @param {String} prefix - Folder prefix (e.g., 'profile-pictures/userId')
 */
async function deleteFolderContents(prefix) {
  if (!USE_S3) {
    logger.info('S3 disabled, skipping folder deletion');
    return;
  }

  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    
    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      logger.info(`No files found in ${prefix}`);
      return;
    }

    // Delete all objects
    for (const object of listResponse.Contents) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: object.Key,
      });
      await s3Client.send(deleteCommand);
      logger.info(`Deleted S3 file: ${object.Key}`);
    }

    logger.info(`Deleted ${listResponse.Contents.length} files from ${prefix}`);
  } catch (error) {
    logger.error(`Failed to delete folder ${prefix}:`, error.message);
    throw error;
  }
}

/**
 * Delete file by URL
 * @param {String} fileUrl - Full S3 URL
 */
async function deleteFileByUrl(fileUrl) {
  if (!USE_S3) {
    return;
  }

  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(deleteCommand);
    logger.info(`Deleted S3 file by URL: ${key}`);
  } catch (error) {
    logger.error(`Failed to delete file ${fileUrl}:`, error.message);
    throw error;
  }
}
