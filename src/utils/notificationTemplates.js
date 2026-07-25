
export const NOTIFICATION_TYPES = {
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
    SMS: 'SMS',
    IN_APP: 'IN_APP',
};

export const TEMPLATES = {
    // === Booking Notifications ===
    BOOKING_CONFIRMATION: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Booking Created',
        body: (data) => `Your ${data.serviceType || 'service'} booking has been created and sent to nearby providers.`,
    },
    BOOKING_ACCEPTED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Booking Accepted',
        body: (data) => `Your ${data.serviceType || 'service'} booking has been accepted by ${data.providerName || 'a provider'}.`,
    },
    BOOKING_COMPLETED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Booking Completed',
        body: () => 'Your booking has been completed. Thank you!',
    },
    BOOKING_CANCELLED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Booking Cancelled',
        body: (data) => data.reason ? `Booking cancelled: ${data.reason}` : 'Your booking has been cancelled.',
    },
    BOOKING_REQUEST: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'New Booking Request',
        body: (data) => `New ${data.serviceType || 'service'} request from ${data.patientName || 'a patient'}.`,
    },

    // === Provider Notifications ===
    PROVIDER_ARRIVING: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Provider Arriving',
        body: (data) => `Your provider will arrive in approximately ${data.eta} minutes.`,
    },

    // === Emergency Notifications ===
    EMERGENCY_ALERT: {
        type: NOTIFICATION_TYPES.PUSH,
        title: '🚨 Emergency Request',
        body: (data) => `Emergency ${data.type || 'service'} request from ${data.address || 'Emergency location'}.`,
    },

    // === Prescription Notifications ===
    PRESCRIPTION_UPLOADED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Prescription Ready',
        body: () => 'Your doctor has uploaded your prescription.',
    },
    PRESCRIPTION_AVAILABLE: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Prescription Available',
        body: () => 'Your doctor has uploaded your prescription. You can now view and download it.',
    },
    PRESCRIPTION_READY: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Prescription Ready',
        body: () => 'Your prescription is ready to download. Please check your booking details.',
    },

    // === Lab / Pathology Notifications ===
    REPORT_READY: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Report Ready',
        body: () => 'Your test report is ready for download.',
    },
    COLLECTION_SCHEDULED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Sample Collection Scheduled',
        body: (data) => `Your sample collection has been scheduled for ${data.date} at ${data.time}.`,
    },
    LAB_TEST_REQUEST: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'New Lab Test Request',
        body: (data) => `New lab test request: ${data.testCount} test(s) - Total: ₹${data.totalAmount}`,
    },

    // === Medicine / Pharmacist Notifications ===
    MEDICINE_ORDER_REQUEST: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'New Medicine Order',
        body: (data) => `New medicine order received. ${data.itemCount} item(s) - Total: ₹${data.totalAmount}`,
    },

    // === Nurse Notifications ===
    NURSE_REQUEST: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'New Nursing Service Request',
        body: (data) => `New nursing service request: ${data.serviceType} for ${data.duration} day(s) - ₹${data.totalAmount}`,
    },

    // === Meeting / Video Call Notifications ===
    MEETING_CREATED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Video Consultation Link Ready',
        body: () => 'Your video consultation link has been created. You will receive a reminder before the meeting.',
    },
    MEETING_REMINDER: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Meeting Starting Soon',
        body: () => 'Your video consultation is starting in 15 minutes. Click to join.',
    },

    // === Payment Notifications ===
    PAYMENT_SUCCESS: {
        type: NOTIFICATION_TYPES.EMAIL,
        subject: 'Payment Successful',
        body: (data) => `We received your payment of ₹${data.amount} for order #${data.orderId}.`,
    },

    // === Order Notifications ===
    ORDER_CONFIRMED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Order Confirmed',
        body: (data) => `Your order #${data.orderId} has been confirmed!`,
    },
    ORDER_SHIPPED: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Order Shipped',
        body: (data) => `Your order #${data.orderId} is on its way!`,
    },

    // === Registration / Auth Notifications ===
    REGISTRATION_SUCCESSFUL: {
        type: NOTIFICATION_TYPES.PUSH,
        title: 'Registration Successful',
        body: (data) => `Welcome to OnMint Healthcare, ${data.name}! Your ${data.role || 'account'} registration was submitted successfully.`,
    },
    WELCOME: {
        type: NOTIFICATION_TYPES.EMAIL,
        subject: 'Welcome to OurDeals!',
        body: (data) => `Hi ${data.name}, welcome to OurDeals! We are excited to have you on board.`,
    },
};
