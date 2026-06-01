import { errorResponse } from "../utils/response.util.js";

const authorize = (...allowedRoles) => {
  // Flatten in case an array is passed instead of spread args
  const roles = allowedRoles.flat();
  return (req, res, next) => {
   
    if (!req.user) {
      return res.status(401).json(errorResponse("Authentication required"));
    }

 
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json(errorResponse("Access denied. Insufficient permissions"));
    }

    next();
  };
};

const authorizeAdmin = authorize("admin");
const authorizePatient = authorize("patient");
const authorizeDoctor = authorize("doctor");
const authorizeNurse = authorize("nurse");
const authorizePharmacist = authorize("pharmacist");
const authorizeAmbulance = authorize("ambulance");
const authorizeBloodBank = authorize("bloodbank");
const authorizePathology = authorize("pathology");

const authorizeProvider = authorize(
  "doctor",
  "nurse",
  "pharmacist",
  "ambulance",
  "bloodbank",
  "pathology",
);

export {
  authorize,
  authorizeAdmin,
  authorizePatient,
  authorizeDoctor,
  authorizeNurse,
  authorizePharmacist,
  authorizeAmbulance,
  authorizeBloodBank,
  authorizePathology,
  authorizeProvider,
};
