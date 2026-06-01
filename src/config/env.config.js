import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = {
  database: ['MONGODB_URI'],
  jwt: ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'],
  aws: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
  razorpay: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
};

const validateEnv = () => {
  const errors = [];

  for (const [service, vars] of Object.entries(REQUIRED_VARS)) {
    const missing = vars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      errors.push(`[${service}] Missing: ${missing.join(', ')}`);
    }
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    errors.push('[jwt] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  const port = parseInt(process.env.PORT);
  if (process.env.PORT && (isNaN(port) || port < 1 || port > 65535)) {
    errors.push(`[server] PORT must be a valid port number, got "${process.env.PORT}"`);
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:\n' + errors.map(e => `  ${e}`).join('\n'));
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
};

validateEnv();

export const envConfig = {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI,
  jwt: {
    // JWT_SECRET kept for legacy compat (password reset, etc.) — prefer access/refresh secrets
    secret: process.env.JWT_SECRET ?? process.env.JWT_ACCESS_SECRET,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    resetSecret: process.env.JWT_RESET_SECRET ?? process.env.JWT_SECRET ?? process.env.JWT_ACCESS_SECRET,
    accessExpiry: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sns: {
      senderId: process.env.AWS_SNS_SENDER_ID,
      platformApplicationArn: process.env.AWS_SNS_PLATFORM_APPLICATION_ARN,
    },
    s3BucketName: process.env.AWS_S3_BUCKET_NAME,
    sqsQueueName: process.env.AWS_SQS_QUEUE_NAME,
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    secretToken: process.env.ZOOM_SECRET_TOKEN,
    userId: process.env.ZOOM_USER_ID || 'me',
  },
  cors: {
    origins: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) ?? [],
  },
};