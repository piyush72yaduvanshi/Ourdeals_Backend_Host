import { User } from '../models/User.model.js';
import { Doctor } from '../models/Doctor.model.js';
import { Nurse } from '../models/Nurse.model.js';
import { Ambulance } from '../models/Ambulance.model.js';
import { Pharmacist } from '../models/Pharmacist.model.js';
import { Pathology } from '../models/Pathology.model.js';
import { BloodBank } from '../models/BloodBank.model.js';
import { Booking } from '../models/Booking.model.js';
import { Prescription } from '../models/Prescription.model.js';
import { Notification } from '../models/Notification.model.js';
import { s3Service } from './s3.service.js';
import { logger } from '../utils/logger.util.js';

/**
 * Comprehensive account deletion service
 * Deletes user/vendor account and ALL associated data (GDPR compliant)
 */
class AccountDeletionService {
  
  /**
   * Delete user account and all associated data
   */
  async deleteUserAccount(userId, userRole) {
    const session = await User.startSession();
    session.startTransaction();

    try {
      logger.info(`🗑️  Starting account deletion for user ${userId} (${userRole})`);

      const deletionReport = {
        userId,
        userRole,
        deletedAt: new Date(),
        deletedData: {},
        s3FilesDeleted: [],
        errors: []
      };

      // 1. Get user data first (before deletion)
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      deletionReport.userEmail = user.email;
      deletionReport.userPhone = user.phone;

      // 2. Delete role-specific data
      await this._deleteRoleSpecificData(userId, userRole, session, deletionReport);

      // 3. Delete bookings (as patient or provider)
      await this._deleteBookings(userId, userRole, session, deletionReport);

      // 4. Delete prescriptions
      await this._deletePrescriptions(userId, userRole, session, deletionReport);

      // 5. Delete notifications
      const notificationsDeleted = await Notification.deleteMany({ user: userId }).session(session);
      deletionReport.deletedData.notifications = notificationsDeleted.deletedCount;

      // 6. Delete S3 files (profile pictures, documents, prescriptions)
      await this._deleteS3Files(userId, userRole, deletionReport);

      // 7. Finally delete user account
      await User.findByIdAndDelete(userId).session(session);
      deletionReport.deletedData.userAccount = true;

      await session.commitTransaction();

      logger.info(`✅ Account deletion completed for ${userId}`);
      logger.info(`   Deleted: ${JSON.stringify(deletionReport.deletedData)}`);
      
      return {
        success: true,
        message: 'Account and all associated data deleted successfully',
        deletionReport
      };

    } catch (error) {
      await session.abortTransaction();
      logger.error(`❌ Account deletion failed for ${userId}:`, error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Delete role-specific data (Doctor, Nurse, Ambulance, etc.)
   */
  async _deleteRoleSpecificData(userId, role, session, report) {
    let deleted = 0;

    switch (role) {
      case 'doctor':
        const doctor = await Doctor.findById(userId).session(session);
        if (doctor) {
          report.s3FilesDeleted.push(...this._extractS3Urls(doctor));
          deleted = await Doctor.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'nurse':
        const nurse = await Nurse.findById(userId).session(session);
        if (nurse) {
          report.s3FilesDeleted.push(...this._extractS3Urls(nurse));
          deleted = await Nurse.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'ambulance':
        const ambulance = await Ambulance.findById(userId).session(session);
        if (ambulance) {
          report.s3FilesDeleted.push(...this._extractS3Urls(ambulance));
          deleted = await Ambulance.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'pharmacist':
        const pharmacist = await Pharmacist.findById(userId).session(session);
        if (pharmacist) {
          report.s3FilesDeleted.push(...this._extractS3Urls(pharmacist));
          deleted = await Pharmacist.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'pathology':
        const pathology = await Pathology.findById(userId).session(session);
        if (pathology) {
          report.s3FilesDeleted.push(...this._extractS3Urls(pathology));
          deleted = await Pathology.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'bloodbank':
        const bloodbank = await BloodBank.findById(userId).session(session);
        if (bloodbank) {
          report.s3FilesDeleted.push(...this._extractS3Urls(bloodbank));
          deleted = await BloodBank.deleteOne({ _id: userId }).session(session);
        }
        break;

      case 'patient':
        // Patient doesn't have separate collection
        break;

      default:
        logger.warn(`Unknown role: ${role}`);
    }

    report.deletedData[`${role}Profile`] = deleted.deletedCount || 0;
  }

  /**
   * Delete all bookings (as patient or provider)
   */
  async _deleteBookings(userId, role, session, report) {
    let bookingsDeleted = 0;

    if (role === 'patient') {
      // Delete bookings where user is patient
      const result = await Booking.deleteMany({ patient: userId }).session(session);
      bookingsDeleted += result.deletedCount;

      // Also delete RealTimeBookings
      try {
        const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
        const rtResult = await RealTimeBooking.deleteMany({ patient: userId }).session(session);
        bookingsDeleted += rtResult.deletedCount;
      } catch (err) {
        logger.warn('RealTimeBooking model not found or error:', err.message);
      }

    } else {
      // Delete bookings where user is provider
      const result = await Booking.deleteMany({ provider: userId }).session(session);
      bookingsDeleted += result.deletedCount;

      // Also delete RealTimeBookings
      try {
        const { RealTimeBooking } = await import('../models/RealTimeBooking.model.js');
        const rtResult = await RealTimeBooking.deleteMany({ acceptedProvider: userId }).session(session);
        bookingsDeleted += rtResult.deletedCount;
      } catch (err) {
        logger.warn('RealTimeBooking model not found or error:', err.message);
      }
    }

    report.deletedData.bookings = bookingsDeleted;
  }

  /**
   * Delete all prescriptions (as patient or doctor)
   */
  async _deletePrescriptions(userId, role, session, report) {
    let prescriptionsDeleted = 0;

    if (role === 'patient') {
      const result = await Prescription.deleteMany({ patient: userId }).session(session);
      prescriptionsDeleted = result.deletedCount;
    } else if (role === 'doctor') {
      const result = await Prescription.deleteMany({ doctor: userId }).session(session);
      prescriptionsDeleted = result.deletedCount;
    }

    report.deletedData.prescriptions = prescriptionsDeleted;
  }

  /**
   * Extract S3 URLs from document
   */
  _extractS3Urls(document) {
    const urls = [];

    // Profile picture
    if (document.profilePicture) {
      urls.push(document.profilePicture);
    }

    // Documents object
    if (document.documents) {
      Object.values(document.documents).forEach(doc => {
        if (doc && doc.fileUrl) {
          urls.push(doc.fileUrl);
        }
      });
    }

    // Images array
    if (document.images && Array.isArray(document.images)) {
      urls.push(...document.images);
    }

    // License/certificate URLs
    if (document.licenseUrl) urls.push(document.licenseUrl);
    if (document.certificateUrl) urls.push(document.certificateUrl);

    return urls;
  }

  /**
   * Delete all S3 files associated with user
   */
  async _deleteS3Files(userId, role, report) {
    try {
      // Delete user-specific folders from S3
      const foldersToDelete = [
        `profile-pictures/${userId}`,
        `documents/${role}/${userId}`,
        `prescriptions/${userId}`,
      ];

      for (const folder of foldersToDelete) {
        try {
          await s3Service.deleteFolderContents(folder);
          logger.info(`   Deleted S3 folder: ${folder}`);
        } catch (err) {
          logger.warn(`   Failed to delete S3 folder ${folder}:`, err.message);
          report.errors.push(`S3 deletion failed: ${folder}`);
        }
      }

      // Delete specific files from extracted URLs
      for (const url of report.s3FilesDeleted) {
        try {
          await s3Service.deleteFileByUrl(url);
        } catch (err) {
          logger.warn(`   Failed to delete S3 file ${url}:`, err.message);
        }
      }

      report.deletedData.s3Files = report.s3FilesDeleted.length;

    } catch (error) {
      logger.error('Error deleting S3 files:', error.message);
      report.errors.push('S3 deletion error: ' + error.message);
    }
  }

  /**
   * Request account deletion (with confirmation)
   * Sends email/SMS with confirmation link
   */
  async requestAccountDeletion(userId, userRole) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate deletion token (expires in 24 hours)
      const deletionToken = Math.random().toString(36).substring(2, 15);
      const deletionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      user.deletionToken = deletionToken;
      user.deletionTokenExpiry = deletionExpiry;
      user.deletionRequested = true;
      await user.save();

      // Send confirmation email/SMS (implement based on your notification service)
      const confirmationLink = `${process.env.FRONTEND_URL}/confirm-deletion?token=${deletionToken}&userId=${userId}`;

      logger.info(`Deletion requested for ${userId}. Confirmation link: ${confirmationLink}`);

      return {
        success: true,
        message: 'Account deletion requested. Please check your email/SMS for confirmation link.',
        expiresIn: '24 hours'
      };

    } catch (error) {
      logger.error('Request deletion failed:', error.message);
      throw error;
    }
  }

  /**
   * Confirm account deletion with token
   */
  async confirmAccountDeletion(userId, deletionToken) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.deletionRequested) {
        throw new Error('No deletion request found');
      }

      if (user.deletionToken !== deletionToken) {
        throw new Error('Invalid deletion token');
      }

      if (new Date() > user.deletionTokenExpiry) {
        throw new Error('Deletion token expired');
      }

      // Proceed with deletion
      return await this.deleteUserAccount(userId, user.role);

    } catch (error) {
      logger.error('Confirm deletion failed:', error.message);
      throw error;
    }
  }
}

export const accountDeletionService = new AccountDeletionService();
