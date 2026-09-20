import { Router } from "express";
import {
  getStates,
  getDistricts,
  getAllLocations,
  searchDistricts,
} from "../controller/location.controller.js";

const router = Router();

// Public location endpoints
router.get("/states", getStates);
router.get("/districts", getDistricts);
router.get("/cities", getDistricts); // Alias for backward compatibility
router.get("/all", getAllLocations);
router.get("/search", searchDistricts);

export default router;
