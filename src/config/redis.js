import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// Disable Redis if not available
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

let connection = null;
let lastErrorTime = 0;
const ERROR_LOG_INTERVAL = 30000;

if (REDIS_ENABLED) {
  const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('Redis: max retries reached, disabling Redis');
        return null;
      }
      return Math.min(times * 500, 2000);
    },
  };

  connection = new Redis(redisConfig);

  connection.on('connect', () => {
    console.log('✓ Connected to Redis');
  });

  connection.on('error', (err) => {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_LOG_INTERVAL) {
      console.warn('Redis connection error:', err.message);
      lastErrorTime = now;
    }
  });
} else {
  console.log('ℹ Redis disabled - running without cache');
}

export default connection;
