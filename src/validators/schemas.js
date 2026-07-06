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
  "in_cart",
  "requested",
  "accepted",
  "packing_medicines",
  "out_for_delivery",
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
  email: Joi.string().optional(),
  password: Joi.string().optional(),

  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),

  phone: Joi.string().optional(),

  role: Joi.string()
    .valid(...USER_ROLES)
    .optional(),

  address: Joi.string().allow("").optional(),
  city: Joi.string().allow("").optional(),
  state: Joi.string().allow("").optional(),
  pincode: Joi.string().allow("").optional(),

  location: Joi.object({
    type: Joi.string().valid("Point").default("Point").optional(),

    coordinates: Joi.array()
      .items(
        Joi.number().optional(), // longitude
        Joi.number().optional(), // latitude
      )
      .optional(),
  }).optional(),

  specialization: Joi.when("role", {
    is: "doctor",
    then: Joi.string().optional(),
  }),

  category: Joi.when("role", {
    is: "doctor",
    then: Joi.string().valid(
      'General Physician',
      'Dermatology',
      'Gynecology',
      'Mental Wellness',
      'Sexology',
      'Stomach & Digestion',
      'Pediatrics',
      'Orthodpedic'
    ).optional().default('General Physician'),
  }),

  qualifications: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(Joi.string()),
  }),

  experience: Joi.when("role", {
    is: Joi.valid("doctor", "nurse"),
    then: Joi.number().optional(),
  }),

  consultationFee: Joi.when("role", {
    is: "doctor",
    then: Joi.number().optional(),
  }),

  languages: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(Joi.string()),
  }),

  consultationTypes: Joi.when("role", {
    is: "doctor",
    then: Joi.array().items(
      Joi.string().valid("video-call", "audio-call")
    ).default(["video-call"]),
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
    then: Joi.number().optional(),
  }),

  deliveryFee: Joi.when("role", {
    is: "pharmacist",
    then: Joi.number().optional(),
  }),

  operatingHours: Joi.when("role", {
    is: Joi.valid("pharmacist", "bloodbank", "pathology"),
    then: Joi.object({
      open: Joi.string().optional(),
      close: Joi.string().optional(),
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

  inchargeName: Joi.when("role", {
    is: "bloodbank",
    then: Joi.string().optional(),
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
    then: Joi.number().optional(),
  }),

  licenseNumber: Joi.when("role", {
    is: Joi.valid(
      "doctor",
      "nurse",
      "pharmacist",
      "bloodbank",
      "pathology"
    ),
    then: Joi.string().optional(),
  }),

  pharmacyName: Joi.when("role", {
    is: "pharmacist",
    then: Joi.string().optional(),
  }),

  pharmacistName: Joi.when("role", {
    is: "pharmacist",
    then: Joi.string().optional(),
  }),

  pharmacistRegistrationNumber: Joi.when("role", {
    is: "pharmacist",
    then: Joi.string().optional(),
  }),

  servicesAvailable: Joi.when("role", {
    is: Joi.valid("pharmacist", "bloodbank"),
    then: Joi.array().items(Joi.string()).optional(),
  }),

  vehicleNumber: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().optional(),
  }),

  vehicleType: Joi.when("role", {
    is: "ambulance",
    then: Joi.string()
      .valid("Basic", "Advanced Life Support", "ICU Ambulance")
      .optional(),
  }),

  driverName: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().optional(),
  }),

  driverMobileNumber: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().optional(),
  }),

  driverLicense: Joi.when("role", {
    is: "ambulance",
    then: Joi.string().optional(),
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
          Joi.number().optional(), // longitude
          Joi.number().optional(), // latitude
        )
        .optional(),
      lastUpdated: Joi.date(),
    }),
  }),

  bankName: Joi.when("role", {
    is: "bloodbank",
    then: Joi.string().optional(),
  }),

  labName: Joi.when("role", {
    is: "pathology",
    then: Joi.string().optional(),
  }),
});

const loginSchema = Joi.object({
  phone: Joi.string().optional(),
  password: Joi.string().optional(),
});

const createBookingSchema = Joi.object({
  provider: Joi.string().when('serviceType', {
    is: 'ambulance',
    then: Joi.optional(),
    otherwise: Joi.optional() // Changed to optional for all - will be assigned when pharmacist accepts
  }),

  serviceType: Joi.string()
    .valid(...SERVICE_TYPES)
    .optional(),

  name: Joi.string().trim().when('serviceType', {
    is: 'doctor',
    then: Joi.optional()
  }),

  category: Joi.string().valid(
    'General Physician',
    'Dermatology',
    'Gynecology',
    'Mental Wellness',
    'Sexology',
    'Stomach & Digestion',
    'Pediatrics',
    'Orthodpedic'
  ).when('serviceType', {
    is: 'doctor',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),

  scheduledTime: Joi.date().iso(),

  // Made optional - not all bookings need time slots
  timeSlot: Joi.object({
    start: Joi.string().optional(),
    end: Joi.string().optional(),
  }).optional(),

  // Consultation type for doctor bookings
  consultationType: Joi.string().valid('video-call').when('serviceType', {
    is: 'doctor',
    then: Joi.optional().default('video-call'),
    otherwise: Joi.forbidden()
  }),

  // Made optional - not all bookings need location (e.g., video consultations)
  location: Joi.alternatives().try(
    // Standard booking format
    Joi.object({
      address: Joi.string().trim(),
      coordinates: Joi.array()
        .items(
          Joi.number().optional(), // longitude
          Joi.number().optional(), // latitude
        )
        .optional(),
    }),
    // GeoJSON format (for ambulance requests)
    Joi.object({
      type: Joi.string().valid('Point'),
      coordinates: Joi.array()
        .items(
          Joi.number().optional(), // longitude
          Joi.number().optional(), // latitude
        )
        .optional(),
    })
  ).optional(),

  // Support for separate latitude/longitude fields (legacy)
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  address: Joi.string().trim(),

  hospitalName: Joi.string().trim().optional(),
  patientName: Joi.string().trim().optional(),
  contactNumber: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),

  // Medicine order items
  items: Joi.array().items(
    Joi.object({
      medicine: Joi.string().optional(),
      quantity: Joi.number().optional(),
      price: Joi.number().optional(),
    })
  ).when('serviceType', {
    is: 'pharmacist',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),

  // Symptoms for doctor consultations
  symptoms: Joi.string().allow("").when('serviceType', {
    is: 'doctor',
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),

  notes: Joi.string().allow(""),
  price: Joi.number().optional(),
  
  // Blood bank specific fields
  bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').when('serviceType', {
    is: Joi.valid('bloodbank', 'ambulance'),
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),
  unitsRequired: Joi.number().optional().when('serviceType', {
    is: Joi.valid('bloodbank', 'ambulance'),
    then: Joi.optional(),
    otherwise: Joi.forbidden()
  }),
  
  isEmergency: Joi.boolean(),
  paymentMethod: Joi.string().valid('cash', 'online').default('cash'),
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...BOOKING_STATUS)
    .optional(),
});

const ratingSchema = Joi.object({
  rating: Joi.number().optional(),
  review: Joi.string().allow(""),
});

const locationQuerySchema = Joi.object({
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  maxDistance: Joi.number().optional(),
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
          .optional(),
        slots: Joi.array()
          .items(
            Joi.object({
              startTime: Joi.string().optional(),
              endTime: Joi.string().optional(),
              isAvailable: Joi.boolean(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

const medicineSchema = Joi.object({
  name: Joi.string().optional(),
  genericName: Joi.string().allow(""),
  manufacturer: Joi.string().optional(),
  description: Joi.string().allow(""),
  price: Joi.number().optional(),
  discountedPrice: Joi.number().optional(),
  stock: Joi.number().optional(),
  category: Joi.string().optional(),
  requiresPrescription: Joi.boolean(),
  dosageForm: Joi.string().optional(),
  strength: Joi.string().allow(""),
  packaging: Joi.string().allow(""),
  expiryDate: Joi.date(),
});

const bloodStockSchema = Joi.object({
  bloodGroup: Joi.string()
    .valid(...BLOOD_GROUPS)
    .optional(),
  unitsAvailable: Joi.number().optional(),
});

const paginationSchema = Joi.object({
  page: Joi.number().default(1),
  limit: Joi.number().default(20),
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
          Joi.number().optional(), // longitude
          Joi.number().optional(), // latitude
        )
        .default([0, 0]), // Default coordinates if not provided
    }).default({ type: 'Point', coordinates: [0, 0] }),
    address: Joi.string().trim().default('Emergency Location'),
    notes: Joi.string().allow(""),
  }),
  // Legacy format
  Joi.object({
    latitude: Joi.number().default(0),
    longitude: Joi.number().default(0),
    address: Joi.string().trim().default('Emergency Location'),
    notes: Joi.string().allow(""),
  })
);

const idParamSchema = Joi.object({
  id: Joi.string().optional(),
});

const ambulanceSchema = Joi.object({
  // User fields (required for creation)
  email: Joi.string().optional(),
  password: Joi.string().optional(),
  role: Joi.string().valid("ambulance"),
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  phone: Joi.string().optional(),
  city: Joi.string().trim(),
  state: Joi.string().trim(),
  pincode: Joi.string().trim(),
  location: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array()
      .items(
        Joi.number().optional(),
        Joi.number().optional()
      )
      .optional(),
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
        Joi.number().optional(),
        Joi.number().optional()
      )
      .optional(),
  }),
});

const pathologyTestSchema = Joi.object({
  testsOffered: Joi.array().items(
    Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().allow(""),
      price: Joi.number().optional(),
      preparationInstructions: Joi.string().allow(""),
      reportDeliveryTime: Joi.string().default("24hrs"),
    })
  ).optional(),
});

const bloodStockUpdateSchema = Joi.object({
  bloodStock: Joi.array().items(bloodStockSchema).optional(),
});

const createOrderSchema = Joi.object({
  bookingId: Joi.string().optional(),
});

const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().optional(),
  razorpay_payment_id: Joi.string().optional(),
  razorpay_signature: Joi.string().optional(),
  bookingId: Joi.string().optional(),
});

const bankDetailsSchema = Joi.object({
  accountHolderName: Joi.string().trim().optional(),
  accountNumber: Joi.string().optional(),
  ifsc: Joi.string().optional(),
});

const releasePayoutSchema = Joi.object({
  bookingId: Joi.string().optional(),
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
