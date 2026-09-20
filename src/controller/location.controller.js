import { INDIAN_STATES, INDIAN_STATES_DISTRICTS, getAllDistricts } from "../data/indianStatesDistricts.data.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

/**
 * Location Controller
 * Provides API views for Indian States and Districts
 */
export const getStates = async (req, res) => {
  try {
    res.json(
      successResponse("Indian States and Union Territories fetched successfully", {
        total: INDIAN_STATES.length,
        states: INDIAN_STATES,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch states"));
  }
};

export const getDistricts = async (req, res) => {
  try {
    const stateName = req.query.state || req.params.state;
    if (!stateName) {
      return res.status(400).json(errorResponse("State name query parameter (?state=...) is required"));
    }

    // Find state case-insensitively
    const matchedState = INDIAN_STATES.find(
      (s) => s.toLowerCase() === stateName.trim().toLowerCase()
    );

    if (!matchedState) {
      return res.status(404).json(
        errorResponse(`State or Union Territory '${stateName}' not found`, {
          availableStates: INDIAN_STATES,
        })
      );
    }

    const districts = INDIAN_STATES_DISTRICTS[matchedState] || [];
    res.json(
      successResponse(`Districts for ${matchedState} fetched successfully`, {
        state: matchedState,
        total: districts.length,
        districts,
        cities: districts, // Alias for backward compatibility
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch districts"));
  }
};

export const getAllLocations = async (req, res) => {
  try {
    res.json(
      successResponse("All Indian States and Districts fetched successfully", {
        totalStates: INDIAN_STATES.length,
        data: INDIAN_STATES_DISTRICTS,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to fetch locations"));
  }
};

export const searchDistricts = async (req, res) => {
  try {
    const query = req.query.q || req.query.search;
    if (!query || query.trim().length === 0) {
      return res.status(400).json(errorResponse("Search query parameter (?q=...) is required"));
    }

    const q = query.trim().toLowerCase();
    const results = [];

    for (const [state, districts] of Object.entries(INDIAN_STATES_DISTRICTS)) {
      for (const district of districts) {
        if (district.toLowerCase().includes(q)) {
          results.push({ district, state });
        }
      }
    }

    res.json(
      successResponse(`Found ${results.length} district matches for '${query}'`, {
        query,
        total: results.length,
        results,
      })
    );
  } catch (error) {
    res.status(500).json(errorResponse(error.message || "Failed to search districts"));
  }
};
