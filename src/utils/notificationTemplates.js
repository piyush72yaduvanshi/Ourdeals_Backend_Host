
export const NOTIFICATION_TYPES = {
    EMAIL: 'EMAIL',
    PUSH: 'PUSH',
    SMS: 'SMS',
    IN_APP: 'IN_APP',
};

export const TEMPLATES = {
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
    PAYMENT_SUCCESS: {
        type: NOTIFICATION_TYPES.EMAIL,
        subject: 'Payment Successful',
        body: (data) => `We received your payment of ${data.amount} for order #${data.orderId}.`,
    },
    WELCOME: {
        type: NOTIFICATION_TYPES.EMAIL,
        subject: 'Welcome to OurDeals!',
        body: (data) => `Hi ${data.name}, welcome to OurDeals! We are excited to have you on board.`,
    }
};
