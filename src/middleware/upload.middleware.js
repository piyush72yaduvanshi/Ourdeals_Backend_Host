import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = process.env.UPLOAD_DIR || "uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subfolder = file.fieldname || "misc";
    const fullPath = path.join(uploadDir, subfolder);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;

  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPG, PNG, PDF, DOC, and DOCX are allowed",
      ),
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default (increased for PDF reports)
  },
  fileFilter,
});

const uploadProfilePicture = upload.single("profilePicture");

// Flexible prescription upload - supports multiple field names
const uploadPrescription = (req, res, next) => {
  // Try different field names that frontend might use
  const fieldNames = ['prescription', 'file', 'prescriptionFile', 'image'];
  
  // Check which field has the file
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }
  
  // Try each field name dynamically
  let fieldFound = false;
  const originalMiddleware = upload.any(); // Accept any field temporarily
  
  originalMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Find the uploaded file from any of the expected fields
    if (req.files && req.files.length > 0) {
      req.file = req.files[0]; // Use first file as single file
      fieldFound = true;
    }
    
    next();
  });
};

const uploadReport = upload.single("report");
const uploadMedicineImage = upload.single("medicineImage");
// Support 1-5 medicine images
const uploadMedicineImages = upload.array("images", 5);
const uploadMultiple = upload.array("files", 10);

// Document uploads for vendor registration
const uploadDocuments = upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'license', maxCount: 1 },
  { name: 'certificate', maxCount: 1 },
  { name: 'idProof', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'registration', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'experience', maxCount: 1 },
]);

export {
  upload,
  uploadProfilePicture,
  uploadPrescription,
  uploadReport,
  uploadMedicineImage,
  uploadMedicineImages,
  uploadMultiple,
  uploadDocuments,
};
