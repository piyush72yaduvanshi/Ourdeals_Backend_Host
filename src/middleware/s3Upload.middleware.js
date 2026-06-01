import multer from "multer";
import { errorResponse } from "../utils/response.util.js";

// Store files in memory for S3 upload
const storage = multer.memoryStorage();

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const isValidMime = allowedMimeTypes.includes(file.mimetype);
  const ext = file.originalname.split(".").pop().toLowerCase();
  const isValidExt = allowedTypes.test(ext);

  if (isValidMime && isValidExt) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX are allowed"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

// Document upload configurations for different roles
export const uploadDocuments = {
  // Doctor documents
  doctor: upload.fields([
    { name: "medicalRegistrationCertificate", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
    { name: "clinicAddressProof", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 },
  ]),

  // Nurse documents
  nurse: upload.fields([
    { name: "nursingCertificate", maxCount: 1 },
    { name: "registrationCertificate", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
    { name: "experienceCertificate", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 },
  ]),

  // Pathology/Lab documents
  pathology: upload.fields([
    { name: "labRegistrationCertificate", maxCount: 1 },
    { name: "nablCertificate", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
    { name: "ownerIdProof", maxCount: 1 },
    { name: "labPhotos", maxCount: 5 },
  ]),

  // Ambulance documents
  ambulance: upload.fields([
    { name: "vehicleRC", maxCount: 1 },
    { name: "driverLicense", maxCount: 1 },
    { name: "vehicleInsurance", maxCount: 1 },
    { name: "ambulancePhoto", maxCount: 3 },
    { name: "ownerIdProof", maxCount: 1 },
  ]),

  // Blood Bank documents
  bloodbank: upload.fields([
    { name: "governmentLicense", maxCount: 1 },
    { name: "registrationCertificate", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
    { name: "inchargeIdProof", maxCount: 1 },
    { name: "bloodBankPhotos", maxCount: 5 },
  ]),

  // Pharmacist documents
  pharmacist: upload.fields([
    { name: "pharmacyLicense", maxCount: 1 },
    { name: "drugLicense", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
    { name: "ownerIdProof", maxCount: 1 },
    { name: "pharmacyPhotos", maxCount: 5 },
  ]),

  // Single file uploads
  single: (fieldName) => upload.single(fieldName),
  
  // Multiple files
  multiple: (fieldName, maxCount = 10) => upload.array(fieldName, maxCount),
};

// Error handling middleware
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(errorResponse("File size too large. Maximum 10MB allowed"));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json(errorResponse("Too many files uploaded"));
    }
    return res.status(400).json(errorResponse(err.message));
  }
  
  if (err) {
    return res.status(400).json(errorResponse(err.message));
  }
  
  next();
};
