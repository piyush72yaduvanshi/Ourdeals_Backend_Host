import { s3Service } from "../services/s3.service.js";
import { User } from "../models/User.model.js";
import { Doctor } from "../models/Doctor.model.js";
import { Nurse } from "../models/Nurse.model.js";
import { Ambulance } from "../models/Ambulance.model.js";
import { BloodBank } from "../models/BloodBank.model.js";
import { Pathology } from "../models/Pathology.model.js";
import { Pharmacist } from "../models/Pharmacist.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";
import { logger } from "../utils/logger.util.js";

// Document field mappings for each role
const DOCUMENT_FIELDS = {
  doctor: {
    medicalRegistrationCertificate: "Medical Registration Certificate",
    degreeCertificate: "Degree Certificate (MBBS/MD)",
    clinicAddressProof: "Clinic/Hospital Address Proof",
    idProof: "ID Proof (Aadhaar/PAN)",
    profilePhoto: "Profile Photo",
  },
  nurse: {
    nursingCertificate: "Nursing Certificate",
    registrationCertificate: "Registration Certificate",
    idProof: "ID Proof",
    experienceCertificate: "Experience Certificate",
    profilePhoto: "Profile Photo",
  },
  pathology: {
    labRegistrationCertificate: "Lab Registration Certificate",
    nablCertificate: "NABL Certificate",
    addressProof: "Address Proof",
    ownerIdProof: "Owner ID Proof",
    labPhotos: "Lab Photos",
  },
  ambulance: {
    vehicleRC: "Vehicle RC",
    driverLicense: "Driver License",
    vehicleInsurance: "Vehicle Insurance",
    ambulancePhoto: "Ambulance Photo",
    ownerIdProof: "Owner ID Proof",
  },
  bloodbank: {
    governmentLicense: "Government License",
    registrationCertificate: "Registration Certificate",
    addressProof: "Address Proof",
    inchargeIdProof: "Incharge ID Proof",
    bloodBankPhotos: "Blood Bank Photos",
  },
  pharmacist: {
    pharmacyLicense: "Pharmacy License",
    drugLicense: "Drug License",
    addressProof: "Address Proof",
    ownerIdProof: "Owner ID Proof",
    pharmacyPhotos: "Pharmacy Photos",
  },
};

const uploadDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json(errorResponse("No files uploaded"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    // Initialize documents object if not exists
    if (!user.documents) {
      user.documents = {};
    }

    const uploadedDocuments = {};
    const folder = `${userRole}/${userId}`;

    // Upload each file to S3
    for (const [fieldName, files] of Object.entries(req.files)) {
      const fileArray = Array.isArray(files) ? files : [files];
      
      if (fileArray.length === 1) {
        // Single file
        const result = await s3Service.uploadFile(fileArray[0], folder);
        uploadedDocuments[fieldName] = {
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          originalName: result.originalName,
          uploadedAt: new Date(),
          verified: false,
        };
        user.documents[fieldName] = uploadedDocuments[fieldName];
      } else {
        // Multiple files
        const results = await s3Service.uploadMultipleFiles(fileArray, folder);
        uploadedDocuments[fieldName] = results.map(result => ({
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          originalName: result.originalName,
          uploadedAt: new Date(),
          verified: false,
        }));
        user.documents[fieldName] = uploadedDocuments[fieldName];
      }
    }

    // Update user status to pending if all required documents uploaded
    if (userRole !== "patient" && user.status === "active") {
      user.status = "pending";
    }

    await user.save();

    logger.info(`Documents uploaded for user ${userId}`, {
      role: userRole,
      documents: Object.keys(uploadedDocuments),
    });

    res.json(
      successResponse("Documents uploaded successfully", {
        documents: uploadedDocuments,
        status: user.status,
      })
    );
  } catch (error) {
    logger.error("Document upload failed", { error: error.message });
    res.status(500).json(errorResponse(error.message || "Failed to upload documents"));
  }
};

const getMyDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select("documents role status");
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    const requiredFields = DOCUMENT_FIELDS[user.role] || {};
    const uploadedDocs = user.documents || {};

    const documentStatus = Object.keys(requiredFields).map(field => ({
      field,
      label: requiredFields[field],
      uploaded: !!uploadedDocs[field],
      verified: uploadedDocs[field]?.verified || false,
      document: uploadedDocs[field] || null,
    }));

    res.json(
      successResponse("Documents fetched successfully", {
        role: user.role,
        status: user.status,
        documents: documentStatus,
      })
    );
  } catch (error) {
    logger.error("Get documents failed", { error: error.message });
    res.status(500).json(errorResponse("Failed to fetch documents"));
  }
};

const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fieldName } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    if (!user.documents || !user.documents[fieldName]) {
      return res.status(404).json(errorResponse("Document not found"));
    }

    const document = user.documents[fieldName];

    // Delete from S3
    if (Array.isArray(document)) {
      for (const doc of document) {
        await s3Service.deleteFile(doc.fileName);
      }
    } else {
      await s3Service.deleteFile(document.fileName);
    }

    // Remove from database
    user.documents[fieldName] = undefined;
    await user.save();

    logger.info(`Document deleted for user ${userId}`, { fieldName });

    res.json(successResponse("Document deleted successfully"));
  } catch (error) {
    logger.error("Document delete failed", { error: error.message });
    res.status(500).json(errorResponse("Failed to delete document"));
  }
};

const getDocumentDownloadUrl = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fieldName } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    if (!user.documents || !user.documents[fieldName]) {
      return res.status(404).json(errorResponse("Document not found"));
    }

    const document = user.documents[fieldName];
    
    if (Array.isArray(document)) {
      const urls = await Promise.all(
        document.map(doc => s3Service.getSignedDownloadUrl(doc.fileName))
      );
      return res.json(successResponse("Download URLs generated", { urls }));
    } else {
      const url = await s3Service.getSignedDownloadUrl(document.fileName);
      return res.json(successResponse("Download URL generated", { url }));
    }
  } catch (error) {
    logger.error("Get download URL failed", { error: error.message });
    res.status(500).json(errorResponse("Failed to generate download URL"));
  }
};

// Admin: Verify documents
const verifyDocument = async (req, res) => {
  try {
    const { userId, fieldName } = req.params;
    const { verified, rejectionReason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    if (!user.documents || !user.documents[fieldName]) {
      return res.status(404).json(errorResponse("Document not found"));
    }

    if (Array.isArray(user.documents[fieldName])) {
      user.documents[fieldName].forEach(doc => {
        doc.verified = verified;
        doc.verifiedAt = new Date();
        if (rejectionReason) doc.rejectionReason = rejectionReason;
      });
    } else {
      user.documents[fieldName].verified = verified;
      user.documents[fieldName].verifiedAt = new Date();
      if (rejectionReason) {
        user.documents[fieldName].rejectionReason = rejectionReason;
      }
    }

    await user.save();

    logger.info(`Document ${verified ? "verified" : "rejected"} for user ${userId}`, {
      fieldName,
    });

    res.json(
      successResponse(
        `Document ${verified ? "verified" : "rejected"} successfully`,
        { document: user.documents[fieldName] }
      )
    );
  } catch (error) {
    logger.error("Document verification failed", { error: error.message });
    res.status(500).json(errorResponse("Failed to verify document"));
  }
};

export {
  uploadDocuments,
  getMyDocuments,
  deleteDocument,
  getDocumentDownloadUrl,
  verifyDocument,
};
