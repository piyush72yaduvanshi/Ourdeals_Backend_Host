import Joi from "joi";

const USER_ROLES = [
  "admin",
  "patient",
  "doctor",
  "pharmacist",
  "nurse",
  "ambulance",
  "bloodbank",
  "pathology",
];

const SERVICE_TYPES = [
  "doctor",
  "nurse",
  "pharmacist",
  "ambulance",
  "bloodbank",
  "pathology",
];

const BOOKING_STATUS = [
  "requested",
  "accepted",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
];

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),

  firstName: Joi.string().required(),
  lastName: Joi.string().required(),

  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{9,14}$/)
    .required(),

  role: Joi.string()
    .valid(...USER_ROLES)
    .required(),

  address: Joi.string().allow(""),
  city: Joi.string().allow(""),
  state: Joi.string().allow(""),
  pincode: Joi.string().allow(""),

  location: Joi.object({
    type: Joi.string().valid("Point").default("Point").required(),

    coordinates: Joi.array()
      .items(
        Joi.number().min(-180).max(180).required(), // longitude
        Joi.number().min(-90).max(90).required(), // latitude
      )
      .length(2)
      .required(),
  }).required(),

  specialization: Joi.when("role", {
    is: "doctor",
    then: Joi.string().required(),
  }),

  qualifications: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(Joi.string()),
  }),

  experience: Joi.when("role", {
    is: Joi.valid("doctor", "nurse"),
    then: Joi.number().min(0).required(),
  }),

  consultationFee: Joi.when("role", {
    is: "doctor",
    then: Joi.number().min(0).required(),
  }),

  languages: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(Joi.string()),
  }),

  consultationTypes: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(
      Joi.string().valid("video-call", "in-person", "phone-call")
    ).min(1).required(),
  }),

  about: Joi.when("role", {
    is: "doctor",
    then: Joi.string().allow(""),
  }),

  availability: Joi.when("role", {
    is: Joi.valid("doctor", "nurse"),
    then: Joi.array().items(Joi.object()),
  }),

  servicesOffered: Joi.when("role", {
    is: "nurse",
    then: Joi.array().items(Joi.object()),
  }),

  certifications: Joi.when("role", {
    is: Joi.valid("nurse", "pathology"),
    then: Joi.array().items(Joi.string()),
  }),

  specializations: Joi.when("role", {
    is: "nurse",
    then: Joi.array().items(Joi.string()),
  }),

  deliveryTimes: Joi.when("role", {
    is: "pharmacist",
    then: Joi.array().items(Joi.string().valid("30min", "1hr", "same_day")),
  }),

  minimumOrderAmount: Joi.when("role", {
    is: "pharmacist",
    then: Joi.number().min(0),
  }),

  deliveryFee: Joi.when("role", {
    is: "pharmacist",
    then: Joi.number().min(0),
  }),

  operatingHours: Joi.when("role", {
    is: Joi.valid("pharmacist", "bloodbank", "pathology"),
    then: Joi.object({
      open: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
      close: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    }),
  }),

  bloodStock: Joi.when("role", {
    is: "bloodbank",
    then: Joi.array().items(Joi.object()),
  }),

  emergencyContact: Joi.when("role", {
    is: "bloodbank",
    then: Joi.string(),
  }),

  testsOffered: Joi.when("role", {
    is: "pathology",
    then: Joi.array().items(Joi.object()),
  }),

  homeCollectionAvailable: Joi.when("role", {
    is: "pathology",
    then: Joi.boolean(),
  }),

  homeCollectionFee: Joi.when("role", {
    is: "pathology",
    then: Joi.number().min(0),
  }),

  licenseNumber: Joi.when("role", {
    is: Joi.valid(
      "doctor",
      "nurse",
      "pharmacist",
      "bloodbank",
      "pathology"
    ),
    then: Joi.string().required(),
  }),

  pharmacyName: Joi.when("role", {
    is: "pharmacist",
    then: Joi.string().required(),
  }),

  vehicleNumber: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().required(),
  }),

  vehicleType: Joi.when("role", {
    is: "ambulance",
    then: Joi.string()
      .valid("Basic", "Advanced Life Support", "ICU Ambulance")
      .required(),
  }),

  driverName: Joi.when("role", {
    is: "ambulance",
    then: Joi.string(),
  }),

  driverLicense: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().required(),
  }),

  equipmentAvailable: Joi.when("role", {
    is: "ambulance",
    then: Joi.array().items(Joi.string()),
  }),

  isAvailable: Joi.when("role", {
    is: "ambulance",
    then: Joi.boolean(),
  }),

  currentLocation: Joi.when("role", {
    is: "ambulance",
    then: Joi.object({
      type: Joi.string().valid("Point").default("Point"),
      coordinates: Joi.array()
        .items(
          Joi.number().min(-180).max(180).required(), // longitude
          Joi.number().min(-90).max(90).required(), // latitude
        )
        .length(2)
        .required(),
      lastUpdated: Joi.date(),
    }),
  }),

  bankName: Joi.when("role", {
    is: "bloodbank",
    then: Joi.string().required(),
  }),

  labName: Joi.when("role", {
    is: "pathology",
    then: Joi.string().required(),
  }),
});

const loginSchema = Joi.object({
  phone: Joi.string().required(),
  password: Joi.string().required(),
});

const createBookingSchema = Joi.object({
  provider: Joi.string().when('serviceType', {
    is: 'ambulance',
    then: Joi.optional(),
    otherwise: Joi.optional() // Changed to optional for all - will be assigned when pharmacist accepts
  }),

  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .required(),

  scheduledTime: Joi.date().iso(),

  // Made optional - not all bookings need time slots
  timeSlot: Joi.object({
    start: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
    end: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }).optional(),

  // Consultation type for doctor bookings
  consultationType: Joi.string().valid('in-person', 'video-call', 'phone-call').when('serviceType', {
    is: 'doctor',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),

  // Made optional - not all bookings need location (e.g., video consultations)
  location: Joi.alternatives().try(
    // Standard booking format
    Joi.object({
      address: Joi.string().trim(),
      coordinates: Joi.array()
        .items(
          Joi.number().min(-180).max(180), // longitude
          Joi.number().min(-90).max(90), // latitude
        )
        .length(2),
    }),
    // GeoJSON format (for ambulance requests)
    Joi.object({
      type: Joi.string().valid('Point'),
      coordinates: Joi.array()
        .items(
          Joi.number().min(-180).max(180), // longitude
          Joi.number().min(-90).max(90), // latitude
        )
        .length(2),
    })
  ).optional(),

  // Support for separate latitude/longitude fields (legacy)
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  address: Joi.string().trim(),

  // Medicine order items
  items: Joi.array().items(
    Joi.object({
      medicine: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
      quantity: Joi.number().min(1).required(),
      price: Joi.number().min(0).required(),
    })
  ).when('serviceType', {
    is: 'pharmacist',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),

  // Symptoms for doctor consultations
  symptoms: Joi.string().allow("").when('serviceType', {
    is: 'doctor',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),

  notes: Joi.string().allow(""),
  price: Joi.number().when('serviceType', {
    is: 'bloodbank',
    then: Joi.number().min(1).required(), // Required and must be >= 1 for blood bank
    otherwise: Joi.number().min(0).optional()
  }),
  
  // Blood bank specific fields
  bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').when('serviceType', {
    is: 'bloodbank',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  unitsRequired: Joi.number().min(1).max(10).when('serviceType', {
    is: 'bloodbank',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  
  isEmergency: Joi.boolean(),
  paymentMethod: Joi.string().valid('cash', 'online').default('cash'),
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...BOOKING_STATUS)
    .required(),
});

const ratingSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  review: Joi.string().allow(""),
});

const locationQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  maxDistance: Joi.number().min(0).max(50),
  specialization: Joi.string(),
  bloodGroup: Joi.string().valid(...BLOOD_GROUPS),
  serviceType: Joi.string().valid(...SERVICE_TYPES),
});

const availabilitySchema = Joi.object({
  availability: Joi.array()
    .items(
      Joi.object({
        day: Joi.string()
          .valid(...DAYS_OF_WEEK)
          .required(),
        slots: Joi.array()
          .items(
            Joi.object({
              startTime: Joi.string()
                .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
                .required(),
              endTime: Joi.string()
                .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
                .required(),
              isAvailable: Joi.boolean(),
            }),
          )
          .required(),
      }),
    )
    .required(),
});

const medicineSchema = Joi.object({
  name: Joi.string().required(),
  genericName: Joi.string().allow(""),
  manufacturer: Joi.string().required(),
  description: Joi.string().allow(""),
  price: Joi.number().min(0).required(),
  discountedPrice: Joi.number().min(0),
  stock: Joi.number().min(0).required(),
  category: Joi.string().required(),
  requiresPrescription: Joi.boolean(),
  dosageForm: Joi.string().required(),
  strength: Joi.string().allow(""),
  packaging: Joi.string().allow(""),
  expiryDate: Joi.date(),
});

const bloodStockSchema = Joi.object({
  bloodGroup: Joi.string()
    .valid(...BLOOD_GROUPS)
    .required(),
  unitsAvailable: Joi.number().min(0).required(),
});

const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
});

const bookingQuerySchema = paginationSchema.keys({
  status: Joi.string().valid(...BOOKING_STATUS, 'all'),
  serviceType: Joi.string().valid(...SERVICE_TYPES, 'all'),
});

const inventoryQuerySchema = paginationSchema.keys({
  search: Joi.string().allow(''),
  category: Joi.string().allow(''),
});

const emergencySchema = Joi.alternatives().try(
  // GeoJSON format
  Joi.object({
    location: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array()
        .items(
          Joi.number().min(-180).max(180), // longitude
          Joi.number().min(-90).max(90), // latitude
        )
        .length(2)
        .default([0, 0]), // Default coordinates if not provided
    }).default({ type: 'Point', coordinates: [0, 0] }),
    address: Joi.string().trim().default('Emergency Location'),
    notes: Joi.string().allow(""),
  }),
  // Legacy format
  Joi.object({
    latitude: Joi.number().min(-90).max(90).default(0),
    longitude: Joi.number().min(-180).max(180).default(0),
    address: Joi.string().trim().default('Emergency Location'),
    notes: Joi.string().allow(""),
  })
);

const idParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

const ambulanceSchema = Joi.object({
  // User fields (required for creation)
  email: Joi.string().email(),
  password: Joi.string().min(6),
  role: Joi.string().valid("ambulance"),
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/),
  city: Joi.string().trim(),
  state: Joi.string().trim(),
  pincode: Joi.string().trim(),
  location: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array()
      .items(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      )
      .length(2)
      .required(),
  }),
  // Ambulance specific fields
  driverName: Joi.string().trim(),
  driverLicense: Joi.string().trim(),
  vehicleNumber: Joi.string().trim(),
  vehicleType: Joi.string().valid("Basic", "Advanced Life Support", "ICU Ambulance"),
  equipmentAvailable: Joi.array().items(Joi.string()),
  isAvailable: Joi.boolean(),
  currentLocation: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array()
      .items(
        Joi.number().min(-180).max(180).required(),
        Joi.number().min(-90).max(90).required()
      )
      .length(2)
      .required(),
  }),
});

const pathologyTestSchema = Joi.object({
  testsOffered: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(""),
      price: Joi.number().min(0).required(),
      preparationInstructions: Joi.string().allow(""),
      reportDeliveryTime: Joi.string().default("24hrs"),
    })
  ).required(),
});

const bloodStockUpdateSchema = Joi.object({
  bloodStock: Joi.array().items(bloodStockSchema).required(),
});

const createOrderSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

const bankDetailsSchema = Joi.object({
  accountHolderName: Joi.string().trim().required(),
  accountNumber: Joi.string()
    .pattern(/^[0-9]{9,18}$/)
    .required(),
  ifsc: Joi.string()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required(),
});

const releasePayoutSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

export {
  registerSchema,
  loginSchema,
  createBookingSchema,
  updateBookingStatusSchema,
  ratingSchema,
  locationQuerySchema,
  availabilitySchema,
  medicineSchema,
  bloodStockSchema,
  paginationSchema,
  bookingQuerySchema,
  inventoryQuerySchema,
  emergencySchema,
  idParamSchema,
  ambulanceSchema,
  pathologyTestSchema,
  bloodStockUpdateSchema,
  createOrderSchema,
  verifyPaymentSchema,
  bankDetailsSchema,
  releasePayoutSchema,
};
