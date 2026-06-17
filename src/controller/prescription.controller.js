import mongoose from 'mongoose';
import { Prescription } from '../models/Prescription.model.js';
import { Booking } from '../models/Booking.model.js';
import { notificationService } from '../services/notification.service.js';
import { logger } from '../utils/logger.util.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

/**
 * Create prescription (Doctor only)
 * POST /api/v1/doctor/prescriptions
 */
export const createPrescription = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const {
      bookingId,
      diagnosis,
      medicines,
      advice,
      followUpDate,
      prescriptionFile,
      notes,
    } = req.body;

    // Validate bookingId format
    if (!bookingId || typeof bookingId !== 'string') {
      logger.error('Invalid bookingId format', { 
        bookingId,
        type: typeof bookingId,
      });
      return res.status(400).json(errorResponse('Invalid bookingId format'));
    }

    // Validate bookingId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      logger.error('Invalid MongoDB ObjectId', { 
        bookingId,
        isValid: mongoose.Types.ObjectId.isValid(bookingId),
      });
      return res.status(400).json(errorResponse('Invalid booking ID format'));
    }

    // Log for debugging
    logger.info('Creating prescription - START', { 
      doctorId, 
      bookingId,
      requestBody: req.body,
    });

    // Validate booking - check with string comparison first
    let booking = await Booking.findOne({
      _id: new mongoose.Types.ObjectId(bookingId),
    }).populate('patient');

    logger.info('Booking query result', { 
      bookingId,
      bookingFound: !!booking,
      bookingData: booking ? {
        id: booking._id,
        provider: booking.provider,
        status: booking.status,
        serviceType: booking.serviceType,
      } : null,
    });

    if (!booking) {
      logger.error('Booking not found in database', { 
        bookingId,
        doctorId,
        searchQuery: { _id: bookingId },
      });
      return res.status(404).json(errorResponse('Booking not found'));
    }

    // Check if doctor is the provider (convert both to strings for comparison)
    const bookingProviderId = booking.provider ? booking.provider.toString() : null;
    logger.info('Provider verification', { 
      doctorId,
      bookingProviderId,
      match: bookingProviderId === doctorId,
    });

    if (!bookingProviderId || bookingProviderId !== doctorId) {
      logger.error('Doctor not authorized for this booking', { 
        doctorId, 
        bookingProviderId,
        bookingId,
      });
      return res.status(403).json(errorResponse('You are not the provider for this booking'));
    }

    // Check booking status
    logger.info('Booking status check', { 
      status: booking.status,
      isValid: ['in_progress', 'completed'].includes(booking.status),
    });

    if (!['in_progress', 'completed'].includes(booking.status)) {
      logger.error('Booking status not valid for prescription', { 
        status: booking.status,
        bookingId,
      });
      return res.status(400).json(errorResponse(`Booking must be in progress or completed. Current status: ${booking.status}`));
    }

    // Check if prescription already exists
    const existingPrescription = await Prescription.findOne({ booking: bookingId });
    if (existingPrescription) {
      logger.warn('Prescription already exists', { bookingId });
      return res.status(400).json(errorResponse('Prescription already exists for this booking'));
    }

    // Create prescription
    const prescription = new Prescription({
      booking: bookingId,
      patient: booking.patient._id,
      doctor: doctorId,
      diagnosis,
      medicines: medicines || [],
      advice,
      followUpDate,
      prescriptionFile,
      notes,
    });

    await prescription.save();

    // Update booking with prescription reference
    booking.prescription = prescription._id;
    await booking.save();

    // Send notification to patient
    try {
      await notificationService.sendPrescriptionAvailable(
        booking.patient._id,
        prescription._id.toString()
      );
    } catch (notifError) {
      logger.error('Failed to send prescription notification', {
        error: notifError.message,
      });
    }

    logger.info('Prescription created successfully', {
      prescriptionId: prescription._id,
      bookingId,
      doctorId,
    });

    res.status(201).json(successResponse('Prescription created successfully', prescription));
  } catch (error) {
    logger.error('Create prescription failed', { 
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
    });
    res.status(500).json(errorResponse(error.message || 'Failed to create prescription'));
  }
};

/**
 * Get prescription by ID
 * GET /api/v1/prescriptions/:id
 */
export const getPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const prescription = await Prescription.findById(id)
      .populate('patient', 'firstName lastName email phone')
      .populate('doctor', 'firstName lastName specialization')
      .populate('booking');

    if (!prescription) {
      return res.status(404).json(errorResponse('Prescription not found'));
    }

    // Check authorization
    if (
      prescription.patient._id.toString() !== userId &&
      prescription.doctor._id.toString() !== userId
    ) {
      return res.status(403).json(errorResponse('Unauthorized access'));
    }

    res.status(200).json(successResponse('Prescription retrieved', prescription));
  } catch (error) {
    logger.error('Get prescription failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Get patient prescriptions
 * GET /api/v1/patient/prescriptions
 */
export const getPatientPrescriptions = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const [prescriptions, total] = await Promise.all([
      Prescription.find({ patient: patientId })
        .populate('doctor', 'firstName lastName specialization')
        .populate('booking', 'scheduledTime consultationType')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Prescription.countDocuments({ patient: patientId }),
    ]);

    res.status(200).json(successResponse('Prescriptions retrieved', {
      prescriptions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    }));
  } catch (error) {
    logger.error('Get patient prescriptions failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Get doctor prescriptions
 * GET /api/v1/doctor/prescriptions
 */
export const getDoctorPrescriptions = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const [prescriptions, total] = await Promise.all([
      Prescription.find({ doctor: doctorId })
        .populate('patient', 'firstName lastName email phone')
        .populate('booking', 'scheduledTime consultationType')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Prescription.countDocuments({ doctor: doctorId }),
    ]);

    res.status(200).json(successResponse('Prescriptions retrieved', {
      prescriptions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    }));
  } catch (error) {
    logger.error('Get doctor prescriptions failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};

/**
 * Update prescription
 * PATCH /api/v1/doctor/prescriptions/:id
 */
export const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.userId;
    const updateData = req.body;

    const prescription = await Prescription.findOne({
      _id: id,
      doctor: doctorId,
    });

    if (!prescription) {
      return res.status(404).json(errorResponse('Prescription not found'));
    }

    // Update fields
    Object.assign(prescription, updateData);
    await prescription.save();

    logger.info('Prescription updated', { prescriptionId: id });

    res.status(200).json(successResponse('Prescription updated successfully', prescription));
  } catch (error) {
    logger.error('Update prescription failed', { error: error.message });
    res.status(400).json(errorResponse(error.message));
  }
};
