const UserRole = {
  ADMIN: "admin",
  PATIENT: "patient",
  DOCTOR: "doctor",
  PHARMACIST: "pharmacist",
  NURSE: "nurse",
  AMBULANCE: "ambulance",
  BLOOD_BANK: "bloodbank",
  PATHOLOGY: "pathology",
  LABTEST: "labtest",
};

const UserStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  BLOCKED: "blocked",
  ACTIVE: "active",
};

const BookingStatus = {
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  ON_THE_WAY: "on_the_way",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const ServiceType = {
  DOCTOR: "doctor",
  NURSE: "nurse",
  AMBULANCE: "ambulance",
  PHARMACIST: "pharmacist",
  BLOOD_BANK: "bloodbank",
  PATHOLOGY: "pathology",
  LABTEST: "labtest",
};

const BloodGroup = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
};

const NotificationType = {
  BOOKING_CONFIRMATION: "booking_confirmation",
  BOOKING_ACCEPTED: "booking_accepted",
  PROVIDER_ARRIVING: "provider_arriving",
  ORDER_DELIVERED: "order_delivered",
  EMERGENCY_TRIGGERED: "emergency_triggered",
  APPOINTMENT_REMINDER: "appointment_reminder",
  PRESCRIPTION_UPLOADED: "prescription_uploaded",
  REPORT_READY: "report_ready",
};

const DayOfWeek = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
};

export {
  UserRole,
  UserStatus,
  BookingStatus,
  ServiceType,
  BloodGroup,
  NotificationType,
  DayOfWeek,
};
