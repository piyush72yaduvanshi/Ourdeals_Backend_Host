import { getDistance } from "geolib";

const calculateDistance = (point1, point2) => {
  const distanceInMeters = getDistance(
    { latitude: point1.latitude, longitude: point1.longitude },
    { latitude: point2.latitude, longitude: point2.longitude },
  );

  return distanceInMeters / 1000; // meters → km
};

const isWithinRadius = (center, point, radiusInKm) => {
  const distance = calculateDistance(center, point);
  return distance <= radiusInKm;
};

const validateCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const toGeoJSON = (latitude, longitude) => {
  return {
    type: "Point",
    coordinates: [longitude, latitude], 
  };
};

const fromGeoJSON = (geoJson) => {
  return {
    longitude: geoJson.coordinates[0],
    latitude: geoJson.coordinates[1],
  };
};

export {
  calculateDistance,
  isWithinRadius,
  validateCoordinates,
  toGeoJSON,
  fromGeoJSON,
};
