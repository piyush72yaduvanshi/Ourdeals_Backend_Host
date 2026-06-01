import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/healthCheck.routes.js";
import adminRouter from "./routes/admin.routes.js";
import patientRouter from "./routes/patient.routes.js";
import doctorRouter from "./routes/doctor.routes.js";
import ambulanceRouter from "./routes/ambulance.routes.js";
import nurseRouter from "./routes/nurse.routes.js";
import pharmacistRouter from "./routes/pharmacist.routes.js";
import bloodbankRouter from "./routes/bloodbank.routes.js";
import pathologyRouter from "./routes/pathology.routes.js";
import realTimeBookingRouter from "./routes/realTimeBooking.routes.js";
import documentRouter from "./routes/document.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import prescriptionRouter from "./routes/prescription.routes.js";
import bookingRouter from "./routes/booking.routes.js";
import medicineRouter from "./routes/medicine.routes.js";
import videoRoom from "./routes/video.routes.js"
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { logger } from "./utils/logger.util.js";

const app = express();

// ============================================
// SECURITY MIDDLEWARE (CRITICAL FIXES)
// ============================================

// 1. Helmet - Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.razorpay.com'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// 2. CORS - Whitelist Origins (CRITICAL FIX)
// const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
//   'http://localhost:3000',
//   'http://localhost:5173',
// ];

const allowedOrigins = "*";

// app.use(cors({
//   origin: (origin, callback) => {
//     // Allow requests with no origin (mobile apps, Postman, server-to-server)
//     if (!origin) return callback(null, true);
    
//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       logger.warn('CORS blocked', { origin, allowedOrigins });
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'x-platform', 'idempotency-key'],
//   maxAge: 86400, // 24 hours
// }));

app.use(cors({
  origin: true,   // ✅ allow all dynamic origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-platform', 'idempotency-key'],
}));

// 3. Request ID Tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});

// 4. Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// 5. Body Parsing with Error Handling
app.use(express.json({ 
  limit: "16kb",
  verify: (req, res, buf, encoding) => {
    // Store raw body for error logging
    req.rawBody = buf.toString(encoding || 'utf8');
    
    // Log emergency and blood bank requests
    if (req.path.includes('/emergency') || req.path.includes('/bookings')) {
      console.log('=== RAW REQUEST ===');
      console.log('Path:', req.path);
      console.log('Method:', req.method);
      console.log('Raw Body:', req.rawBody);
      console.log('Body Length:', req.rawBody.length);
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('=== JSON PARSE ERROR ===');
    console.error('Message:', err.message);
    console.error('Path:', req.path);
    console.error('Method:', req.method);
    console.error('Content-Type:', req.headers['content-type']);
    
    if (req.rawBody) {
      const pos = parseInt(err.message.match(/position (\d+)/)?.[1] || '0');
      console.error('Raw Body:', req.rawBody);
      console.error('Body Length:', req.rawBody.length);
      console.error('Error Position:', pos);
      console.error('Character at position:', {
        char: req.rawBody[pos],
        charCode: req.rawBody.charCodeAt(pos),
        hex: req.rawBody.charCodeAt(pos).toString(16),
      });
      console.error('Context (20 chars before and after):', 
        req.rawBody.substring(Math.max(0, pos - 20), Math.min(req.rawBody.length, pos + 20))
      );
    }
    console.error('=== END JSON PARSE ERROR ===');
    
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
      error: err.message,
      hint: 'Check for trailing commas, missing quotes, or invalid characters'
    });
  }
  next(err);
});

// 6. MongoDB Injection Protection (CRITICAL FIX)
// Custom sanitization middleware for Express 5 compatibility
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      if (key.includes('$') || key.includes('.')) {
        logger.warn('Input sanitized - potential injection attempt', { 
          requestId: req.id, 
          key,
          path: req.path,
          ip: req.ip,
        });
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    });
    return obj;
  };

  // Sanitize body and params (query is read-only in Express 5)
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  
  next();
};

app.use(sanitizeInput);

// 7. Cookie Parser
app.use(cookieParser());

// 8. Serve Static Files (CRITICAL FIX for PDF access)
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

console.log('✅ Static files served from:', path.join(__dirname, '../uploads'));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1", healthRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/patient", patientRouter);
app.use("/api/v1/doctor", doctorRouter);
app.use("/api/v1/ambulance", ambulanceRouter);
app.use("/api/v1/nurse", nurseRouter);
app.use("/api/v1/pharmacist", pharmacistRouter);
app.use("/api/v1/bloodbank", bloodbankRouter);
app.use("/api/v1/pathology", pathologyRouter);
app.use("/api/v1/realtime", realTimeBookingRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1", prescriptionRouter);
app.use("/api/v1/medicines", medicineRouter);
app.use("/api/v1/video",videoRoom)

app.get("/hello", (req, res) => {
  res.json({
    message: "OurDeals Healthcare API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFoundHandler); 
app.use(errorHandler); 

export default app;
