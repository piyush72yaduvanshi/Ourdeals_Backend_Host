import { RealTimeBooking } from '../models/RealTimeBooking.model.js';
import { logger } from './logger.util.js';

/**
 * Expire old pending/requested orders that are older than 24 hours
 * This ONLY changes status to 'expired', does NOT delete documents
 * Users and vendors can still see expired orders in their history
 */
export const expireOldPendingOrders = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await RealTimeBooking.updateMany(
      {
        status: { $in: ['pending', 'requested', 'in_cart'] },
        createdAt: { $lt: twentyFourHoursAgo },
      },
      {
        $set: { 
          status: 'expired',
          // Keep expiresAt field for reference
          expiredAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Expired ${result.modifiedCount} old pending orders`);
    }

    return result;
  } catch (error) {
    logger.error('Error expiring old pending orders:', error);
    throw error;
  }
};

/**
 * Start periodic cleanup job to expire old pending orders
 * Runs every 1 hour
 */
export const startOrderExpirationJob = () => {
  // Run immediately on startup
  expireOldPendingOrders().catch(err => {
    logger.error('Initial order expiration failed:', err);
  });

  // Then run every 1 hour
  const intervalId = setInterval(() => {
    expireOldPendingOrders().catch(err => {
      logger.error('Scheduled order expiration failed:', err);
    });
  }, 60 * 60 * 1000); // 1 hour in milliseconds

  logger.info('Order expiration job started - runs every 1 hour');

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    logger.info('Order expiration job stopped');
  };
};

/**
 * Get expired orders count for monitoring
 */
export const getExpiredOrdersCount = async () => {
  try {
    const count = await RealTimeBooking.countDocuments({
      status: 'expired'
    });
    return count;
  } catch (error) {
    logger.error('Error getting expired orders count:', error);
    return 0;
  }
};
