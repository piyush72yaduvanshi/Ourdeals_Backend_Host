import { User } from "../models/User.model.js";
import { calculateDistance } from "../utils/geolocation.util.js";
import { logger } from "../utils/logger.util.js";

const UserRole = {
  DOCTOR: "doctor",
  NURSE: "nurse",
  PHARMACIST: "pharmacist",
  AMBULANCE: "ambulance",
  BLOOD_BANK: "bloodbank",
  PATHOLOGY: "pathology",
};

const UserStatus = {
  APPROVED: "approved",
};

const DEFAULT_RADIUS = Number(process.env.MAX_SERVICE_RADIUS) || 10;

// Function to get all providers without location filtering
const findAllProviders = async (filter = {}) => {
  const query = {
    status: filter.status || UserStatus.APPROVED,
  };

  if (filter.role) {
    query.role = filter.role;
  }

  try {
    const providers = await User.find(query).select("-password").limit(100).lean();

    // Return providers without distance calculation
    return providers.map((provider) => ({
      ...provider,
      distance: null, // No distance when location not provided
    }));
  } catch (error) {
    logger.error('Provider query failed', { 
      error: error.message, 
      filter 
    });
    throw new Error(`Failed to find providers: ${error.message}`);
  }
};

const findProvidersNearby = async (location, filter = {}) => {
  // If no location provided, return all providers
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return findAllProviders(filter);
  }

  if (location.latitude < -90 || location.latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (location.longitude < -180 || location.longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  const maxDistance = location.maxDistance || DEFAULT_RADIUS;

  const query = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        $maxDistance: maxDistance * 1000,
      },
    },
    status: filter.status || UserStatus.APPROVED,
  };

  if (filter.role) {
    query.role = filter.role;
  }

  try {
    const providers = await User.find(query).select("-password").limit(50).lean();

    const providersWithDistance = providers.map((provider) => {
      let distance = 0;

      if (provider.location?.coordinates && Array.isArray(provider.location.coordinates) && provider.location.coordinates.length === 2) {
        distance = calculateDistance(
          { latitude: location.latitude, longitude: location.longitude },
          {
            latitude: provider.location.coordinates[1],
            longitude: provider.location.coordinates[0],
          },
        );
      }

      return {
        ...provider,
        distance: Number(distance.toFixed(2)),
      };
    });

    return providersWithDistance.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    logger.error('Geospatial query failed', { 
      error: error.message, 
      location,
      filter 
    });
    throw new Error(`Failed to find nearby providers: ${error.message}`);
  }
};

const findDoctorsNearby = async (location, specialization) => {
  const doctors = await findProvidersNearby(location, {
    role: UserRole.DOCTOR,
    status: UserStatus.APPROVED,
  });

  // Calculate distance for each doctor if location provided
  const doctorsWithDistance = doctors.map((doctor) => {
    if (location && location.latitude && location.longitude && doctor.location?.coordinates) {
      const distance = calculateDistance(
        { latitude: location.latitude, longitude: location.longitude },
        {
          latitude: doctor.location.coordinates[1],
          longitude: doctor.location.coordinates[0],
        },
      );
      return {
        ...doctor,
        distance: Number(distance.toFixed(2)),
      };
    }
    return doctor;
  });

  if (specialization) {
    return doctorsWithDistance.filter(
      (doc) =>
        doc.specialization?.toLowerCase() === specialization.toLowerCase(),
    );
  }

  return doctorsWithDistance;
};

const findNursesNearby = async (location) => {
  const nurses = await findProvidersNearby(location, {
    role: UserRole.NURSE,
    status: UserStatus.APPROVED,
  });

  // Calculate distance for each nurse if location provided
  const nursesWithDistance = nurses.map((nurse) => {
    if (location && location.latitude && location.longitude && nurse.location?.coordinates) {
      const distance = calculateDistance(
        { latitude: location.latitude, longitude: location.longitude },
        {
          latitude: nurse.location.coordinates[1],
          longitude: nurse.location.coordinates[0],
        },
      );
      return {
        ...nurse,
        distance: Number(distance.toFixed(2)),
      };
    }
    return nurse;
  });

  return nursesWithDistance;
};

const findAmbulancesNearby = async (location) => {
  // For ambulances, location is required for emergency services
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    // Return all available ambulances without distance sorting
    const ambulances = await findAllProviders({
      role: UserRole.AMBULANCE,
      status: UserStatus.APPROVED,
    });
    return ambulances.filter((amb) => amb.isAvailable === true);
  }

  const ambulances = await findProvidersNearby(location, {
    role: UserRole.AMBULANCE,
    status: UserStatus.APPROVED,
  });

  return ambulances.filter((amb) => amb.isAvailable === true);
};

const findPharmaciesNearby = (location) =>
  findProvidersNearby(location, {
    role: UserRole.PHARMACIST,
    status: UserStatus.APPROVED,
  });

const findBloodBanksNearby = async (location, bloodGroup) => {
  const banks = await findProvidersNearby(location, {
    role: UserRole.BLOOD_BANK,
    status: UserStatus.APPROVED,
  });

  if (bloodGroup) {
    return banks.filter((bank) => {
      const stock = bank.bloodStock?.find((s) => s.bloodGroup === bloodGroup);
      return stock && stock.unitsAvailable > 0;
    });
  }

  return banks;
};

const findPathologyLabsNearby = (location) =>
  findProvidersNearby(location, {
    role: UserRole.PATHOLOGY,
    status: UserStatus.APPROVED,
  });

const updateUserLocation = async (userId, latitude, longitude) => {
  await User.findByIdAndUpdate(userId, {
    location: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
  });
};

const calculateETA = (distanceInKm, averageSpeed = 40) => {
  const timeInHours = distanceInKm / averageSpeed;
  return Math.ceil(timeInHours * 60);
};

export const locationService = {
  findAllProviders,
  findProvidersNearby,
  findDoctorsNearby,
  findNursesNearby,
  findAmbulancesNearby,
  findPharmaciesNearby,
  findBloodBanksNearby,
  findPathologyLabsNearby,
  updateUserLocation,
  calculateETA,
};
