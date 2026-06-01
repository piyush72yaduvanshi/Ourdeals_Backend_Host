import { bookingService } from '../services/booking.service.js';
import { s3Service } from '../services/s3.service.js';
import { successResponse, errorResponse } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Create booking with optional medical documents upload
 * POST /api/v1/bookings/with-documents
 * FIXED: Added file size and count validation
 */
export const createBookingWithDocuments = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    // FIXED: Validate file upload limits before processing
    if (req.files) {
      const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
      const MAX_FILE_COUNT = 20;
      
      let totalSize = 0;
      let totalCount = 0;
      
      // Calculate total size and count
      Object.values(req.files).forEach(fileArray => {
        const files = Array.isArray(fileArray) ? fileArray : [fileArray];
        files.forEach(file => {
          totalSize += file.size;
          totalCount++;
        });
      });
      
      if (totalSize > MAX_TOTAL_SIZE) {
        return res.status(400).json(errorResponse(
          `Total file size exceeds limit. Maximum allowed: 50MB, uploaded: ${(totalSize / 1024 / 1024).toFixed(2)}MB`
        ));
      }
      
      if (totalCount > MAX_FILE_COUNT) {
        return res.status(400).json(errorResponse(
          `Too many files. Maximum allowed: ${MAX_FILE_COUNT}, uploaded: ${totalCount}`
        ));
      }
    }
    
    // Parse booking data from form-data
    const bookingData = {
      patient: patientId,
      provider: req.body.provider,
      serviceType: req.body.serviceType,
      scheduledTime: req.body.scheduledTime,
      price: parseFloat(req.body.price),
      notes: req.body.notes,
      consultationType: req.body.consultationType || 'VIDEO_CALL',
      isEmergency: req.body.isEmergency === 'true',
    };

    // Handle location data
    if (req.body.location) {
      try {
        bookingData.location = typeof req.body.location === 'string' 
          ? JSON.parse(req.body.location) 
          : req.body.location;
      } catch (e) {
        return res.status(400).json(errorResponse('Invalid location format'));
      }
    } else if (req.body.address && req.body.coordinates) {
      bookingData.location = {
        address: req.body.address,
        coordinates: JSON.parse(req.body.coordinates),
      };
    }

    // Handle time slot
    if (req.body.timeSlot) {
      try {
        bookingData.timeSlot = typeof req.body.timeSlot === 'string'
          ? JSON.parse(req.body.timeSlot)
          : req.body.timeSlot;
      } catch (e) {
        return res.status(400).json(errorResponse('Invalid timeSlot format'));
      }
    }

    // Validate required fields
    if (!bookingData.provider) {
      return res.status(400).json(errorResponse('Provider ID is required'));
    }
    if (!bookingData.serviceType) {
      return res.status(400).json(errorResponse('Service type is required'));
    }
    if (!bookingData.location) {
      return res.status(400).json(errorResponse('Location is required'));
    }

    // FIXED: Handle file uploads with transactional approach (all or nothing)
    const uploadedDocuments = {
      medicalReports: [],
      previousPrescriptions: [],
      otherDocuments: [],
    };
    
    const uploadedFiles = []; // Track all uploaded files for rollback

    try {
      if (req.files) {
        const folder = `bookings/${patientId}`;

        // Upload medical reports
        if (req.files.medicalReports) {
          const reports = Array.isArray(req.files.medicalReports) 
            ? req.files.medicalReports 
            : [req.files.medicalReports];
          
          for (const file of reports) {
            const result = await s3Service.uploadFile(file, folder);
            uploadedFiles.push(result.fileName); // Track for rollback
            uploadedDocuments.medicalReports.push({
              fileName: result.fileName,
              fileUrl: result.fileUrl,
              originalName: result.originalName,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedAt: new Date(),
            });
          }
        }

        // Upload previous prescriptions
        if (req.files.previousPrescriptions) {
          const prescriptions = Array.isArray(req.files.previousPrescriptions)
            ? req.files.previousPrescriptions
            : [req.files.previousPrescriptions];
          
          for (const file of prescriptions) {
            const result = await s3Service.uploadFile(file, folder);
            uploadedFiles.push(result.fileName); // Track for rollback
            uploadedDocuments.previousPrescriptions.push({
              fileName: result.fileName,
              fileUrl: result.fileUrl,
              originalName: result.originalName,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedAt: new Date(),
            });
          }
        }

        // Upload other documents
        if (req.files.otherDocuments) {
          const others = Array.isArray(req.files.otherDocuments)
            ? req.files.otherDocuments
            : [req.files.otherDocuments];
          
          for (const file of others) {
            const result = await s3Service.uploadFile(file, folder);
            uploadedFiles.push(result.fileName); // Track for rollback
            uploadedDocuments.otherDocuments.push({
              fileName: result.fileName,
              fileUrl: result.fileUrl,
              originalName: result.originalName,
              description: req.body.documentDescription || '',
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedAt: new Date(),
            });
          }
        }

        // Add documents to booking data
        bookingData.patientDocuments = uploadedDocuments;
      }

      // Create booking - if this fails, we'll rollback uploaded files
      const booking = await bookingService.createBooking(bookingData);

      logger.info('Booking created with documents', {
        bookingId: booking._id,
        patientId,
        documentsCount: {
          medicalReports: uploadedDocuments.medicalReports.length,
          previousPrescriptions: uploadedDocuments.previousPrescriptions.length,
          otherDocuments: uploadedDocuments.otherDocuments.length,
        },
      });

      res.status(201).json(
        successResponse('Booking created successfully with documents', {
          booking,
          uploadedDocuments: {
            medicalReports: uploadedDocuments.medicalReports.length,
            previousPrescriptions: uploadedDocuments.previousPrescriptions.length,
            otherDocuments: uploadedDocuments.otherDocuments.length,
          },
        })
      );
    } catch (uploadOrBookingError) {
      // FIXED: Rollback - delete all uploaded files if booking creation fails
      logger.error('Booking creation failed, rolling back uploaded files', {
        error: uploadOrBookingError.message,
        filesCount: uploadedFiles.length,
      });
      
      for (const fileName of uploadedFiles) {
        try {
          await s3Service.deleteFile(fileName);
          logger.info('Rolled back uploaded file', { fileName });
        } catch (deleteError) {
          logger.error('Failed to delete file during rollback', {
            fileName,
            error: deleteError.message,
          });
        }
      }
      
      throw uploadOrBookingError;
    }
  } catch (error) {
    logger.error('Create booking with documents failed', {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to create booking'));
  }
};

/**
 * Add documents to existing booking
 * POST /api/v1/bookings/:bookingId/documents
 */
export const addDocumentsToBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const patientId = req.user.userId;

    // Verify booking belongs to patient
    const booking = await bookingService.getBooking(bookingId);
    
    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.patient._id.toString() !== patientId) {
      return res.status(403).json(errorResponse('Unauthorized to modify this booking'));
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json(errorResponse('No files uploaded'));
    }

    const folder = `bookings/${patientId}`;
    const uploadedDocuments = {
      medicalReports: [],
      previousPrescriptions: [],
      otherDocuments: [],
    };

    // Upload medical reports
    if (req.files.medicalReports) {
      const reports = Array.isArray(req.files.medicalReports)
        ? req.files.medicalReports
        : [req.files.medicalReports];
      
      for (const file of reports) {
        const result = await s3Service.uploadFile(file, folder);
        uploadedDocuments.medicalReports.push({
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          originalName: result.originalName,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
        });
      }
    }

    // Upload previous prescriptions
    if (req.files.previousPrescriptions) {
      const prescriptions = Array.isArray(req.files.previousPrescriptions)
        ? req.files.previousPrescriptions
        : [req.files.previousPrescriptions];
      
      for (const file of prescriptions) {
        const result = await s3Service.uploadFile(file, folder);
        uploadedDocuments.previousPrescriptions.push({
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          originalName: result.originalName,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
        });
      }
    }

    // Upload other documents
    if (req.files.otherDocuments) {
      const others = Array.isArray(req.files.otherDocuments)
        ? req.files.otherDocuments
        : [req.files.otherDocuments];
      
      for (const file of others) {
        const result = await s3Service.uploadFile(file, folder);
        uploadedDocuments.otherDocuments.push({
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          originalName: result.originalName,
          description: req.body.documentDescription || '',
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
        });
      }
    }

    // Update booking with new documents
    const updatedBooking = await bookingService.addDocumentsToBooking(
      bookingId,
      uploadedDocuments
    );

    logger.info('Documents added to booking', {
      bookingId,
      patientId,
      documentsCount: {
        medicalReports: uploadedDocuments.medicalReports.length,
        previousPrescriptions: uploadedDocuments.previousPrescriptions.length,
        otherDocuments: uploadedDocuments.otherDocuments.length,
      },
    });

    res.json(
      successResponse('Documents added successfully', {
        booking: updatedBooking,
        uploadedDocuments,
      })
    );
  } catch (error) {
    logger.error('Add documents to booking failed', {
      error: error.message,
      bookingId: req.params.bookingId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to add documents'));
  }
};

/**
 * Get booking documents with signed URLs
 * GET /api/v1/bookings/:bookingId/documents
 */
export const getBookingDocuments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const booking = await bookingService.getBooking(bookingId);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check authorization (patient or provider can view)
    const isAuthorized = 
      booking.patient._id.toString() === userId ||
      booking.provider._id.toString() === userId ||
      userRole === 'admin';

    if (!isAuthorized) {
      return res.status(403).json(errorResponse('Unauthorized to view these documents'));
    }

    if (!booking.patientDocuments) {
      return res.json(
        successResponse('No documents found', {
          medicalReports: [],
          previousPrescriptions: [],
          otherDocuments: [],
        })
      );
    }

    // Generate signed URLs for all documents
    const documentsWithUrls = {
      medicalReports: [],
      previousPrescriptions: [],
      otherDocuments: [],
    };

    // Medical reports
    if (booking.patientDocuments.medicalReports) {
      for (const doc of booking.patientDocuments.medicalReports) {
        const signedUrl = await s3Service.getSignedDownloadUrl(doc.fileName, 3600);
        documentsWithUrls.medicalReports.push({
          ...doc.toObject(),
          signedUrl,
        });
      }
    }

    // Previous prescriptions
    if (booking.patientDocuments.previousPrescriptions) {
      for (const doc of booking.patientDocuments.previousPrescriptions) {
        const signedUrl = await s3Service.getSignedDownloadUrl(doc.fileName, 3600);
        documentsWithUrls.previousPrescriptions.push({
          ...doc.toObject(),
          signedUrl,
        });
      }
    }

    // Other documents
    if (booking.patientDocuments.otherDocuments) {
      for (const doc of booking.patientDocuments.otherDocuments) {
        const signedUrl = await s3Service.getSignedDownloadUrl(doc.fileName, 3600);
        documentsWithUrls.otherDocuments.push({
          ...doc.toObject(),
          signedUrl,
        });
      }
    }

    res.json(successResponse('Documents fetched successfully', documentsWithUrls));
  } catch (error) {
    logger.error('Get booking documents failed', {
      error: error.message,
      bookingId: req.params.bookingId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to fetch documents'));
  }
};

/**
 * Delete document from booking
 * DELETE /api/v1/bookings/:bookingId/documents/:documentType/:documentId
 */
export const deleteBookingDocument = async (req, res) => {
  try {
    const { bookingId, documentType, documentId } = req.params;
    const patientId = req.user.userId;

    // Verify booking belongs to patient
    const booking = await bookingService.getBooking(bookingId);

    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    if (booking.patient._id.toString() !== patientId) {
      return res.status(403).json(errorResponse('Unauthorized to modify this booking'));
    }

    // Validate document type
    const validTypes = ['medicalReports', 'previousPrescriptions', 'otherDocuments'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json(errorResponse('Invalid document type'));
    }

    if (!booking.patientDocuments || !booking.patientDocuments[documentType]) {
      return res.status(404).json(errorResponse('Document not found'));
    }

    // Find document
    const documents = booking.patientDocuments[documentType];
    const docIndex = documents.findIndex(doc => doc._id.toString() === documentId);

    if (docIndex === -1) {
      return res.status(404).json(errorResponse('Document not found'));
    }

    const document = documents[docIndex];

    // Delete from S3
    await s3Service.deleteFile(document.fileName);

    // Remove from booking
    const updatedBooking = await bookingService.removeDocumentFromBooking(
      bookingId,
      documentType,
      documentId
    );

    logger.info('Document deleted from booking', {
      bookingId,
      documentType,
      documentId,
    });

    res.json(
      successResponse('Document deleted successfully', {
        booking: updatedBooking,
      })
    );
  } catch (error) {
    logger.error('Delete booking document failed', {
      error: error.message,
      bookingId: req.params.bookingId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to delete document'));
  }
};

/**
 * Create regular booking without documents
 * POST /api/v1/bookings
 */
export const createRegularBooking = async (req, res) => {
  try {
    const patientId = req.user.userId;
    
    console.log('🟢 BOOKING CONTROLLER - createRegularBooking');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    let bookingData = { ...req.body, patient: patientId };
    
    console.log('After spread:', JSON.stringify(bookingData, null, 2));

    // Parse location if it's a string
    if (typeof bookingData.location === 'string') {
      try {
        bookingData.location = JSON.parse(bookingData.location);
      } catch (parseError) {
        return res.status(400).json(errorResponse('Invalid location format'));
      }
    }

    // Parse timeSlot if it's a string
    if (typeof bookingData.timeSlot === 'string') {
      try {
        bookingData.timeSlot = JSON.parse(bookingData.timeSlot);
      } catch (parseError) {
        return res.status(400).json(errorResponse('Invalid timeSlot format'));
      }
    }
    
    // Convert unitsRequired to number for blood bank bookings
    if (bookingData.serviceType === 'bloodbank' && bookingData.unitsRequired) {
      bookingData.unitsRequired = Number(bookingData.unitsRequired);
      console.log('Converted unitsRequired to number:', bookingData.unitsRequired);
    }
    
    console.log('Before service call - bloodGroup:', bookingData.bloodGroup);
    console.log('Before service call - unitsRequired:', bookingData.unitsRequired);

    const { bookingService } = await import('../services/booking.service.js');
    const booking = await bookingService.createBooking(bookingData);

    res.status(201).json(
      successResponse('Booking created successfully', {
        booking,
      })
    );
  } catch (error) {
    logger.error('Create regular booking failed', {
      error: error.message,
      patientId: req.user.userId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to create booking'));
  }
};

/**
 * Update booking consultation type
 * PUT /api/v1/bookings/:bookingId/consultation-type
 */
export const updateConsultationType = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { consultationType } = req.body;
    const userId = req.user.userId;

    // Validate consultation type
    const validTypes = ['in-person', 'video-call', 'phone-call'];
    if (!validTypes.includes(consultationType)) {
      return res.status(400).json(errorResponse('Invalid consultation type'));
    }

    // Get booking and verify authorization
    const booking = await bookingService.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check if user is patient or provider
    const isAuthorized = 
      booking.patient._id.toString() === userId ||
      booking.provider._id.toString() === userId;

    if (!isAuthorized) {
      return res.status(403).json(errorResponse('Unauthorized to modify this booking'));
    }

    // Update consultation type
    booking.consultationType = consultationType;
    
    // Remove location for video/phone calls
    if (consultationType !== 'in-person') {
      booking.location = undefined;
    }
    
    await booking.save();

    logger.info(`Consultation type updated for booking ${bookingId}: ${consultationType}`);

    res.json(
      successResponse('Consultation type updated successfully', {
        booking: {
          _id: booking._id,
          consultationType: booking.consultationType,
          location: booking.location,
        },
      })
    );
  } catch (error) {
    logger.error('Update consultation type failed', {
      error: error.message,
      bookingId: req.params.bookingId,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to update consultation type'));
  }
};
