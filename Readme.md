# 🏥 OurDeals - Healthcare Platform Backend

> **A comprehensive healthcare management platform connecting patients with doctors, nurses, ambulance services, pharmacies, blood banks, and pathology labs.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [📖 Complete Documentation](#-complete-documentation)
- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Setup](#-environment-setup)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Authentication](#-authentication)
- [Notification System](#-notification-system)
- [Background Jobs](#-background-jobs)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 📖 Complete Documentation

**🎉 NEW: Comprehensive documentation is now available!**

For complete system documentation, architecture details, API flows, and deployment guides, see:

### 📚 Main Documentation Files

1. **[Documentation Index](docs/DOCUMENTATION_INDEX.md)** - Start here! Complete guide to all documentation
2. **[Complete Functional Overview](docs/COMPLETE_FUNCTIONAL_OVERVIEW.md)** - Full system documentation (100+ pages)
3. **[API Flow Diagrams](docs/API_FLOW_DIAGRAMS.md)** - Visual representation of all major flows
4. **[Developer Quick Start](docs/DEVELOPER_QUICK_START.md)** - Get started in 5 minutes

### 🚀 Quick Links

- **For Developers**: [Developer Quick Start Guide](docs/DEVELOPER_QUICK_START.md)
- **For DevOps**: [Docker Deployment Guide](docs/DOCKER_DEPLOYMENT_GUIDE.md)
- **For Product Managers**: [Executive Summary](docs/EXECUTIVE_SUMMARY.md)
- **For QA/Testers**: [Postman Collections](docs/) + [API Quick References](docs/)

### 📊 What's Documented

- ✅ Complete system architecture and design
- ✅ All 8 user roles with detailed capabilities
- ✅ 100+ API endpoints with examples
- ✅ Database schema with indexes
- ✅ Real-time features (Socket.IO)
- ✅ Notification system (multi-channel)
- ✅ Location-based services
- ✅ Authentication & security
- ✅ AWS integration (S3, SNS, SQS)
- ✅ Docker deployment
- ✅ 8 Postman collections
- ✅ API flow diagrams
- ✅ Troubleshooting guides

**Total Documentation**: 51 files covering every aspect of the platform!

---

## 🎯 Overview

OurDeals is a **multi-role healthcare platform** backend that enables:
- **Patients** to find and book healthcare services
- **Providers** (doctors, nurses, ambulances, etc.) to manage appointments
- **Real-time notifications** via Firebase (mobile) and WebSocket
- **Location-based search** for nearby services
- **Emergency services** with priority booking
- **Rating & review system** for quality assurance

**Platform Support:**
- ✅ Mobile Apps (React Native / Flutter)
- ✅ Web Apps (React / Next.js)

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based authentication with access & refresh tokens
- Role-based access control (RBAC)
- Multi-role registration (Patient, Doctor, Nurse, Ambulance, etc.)
- Secure password hashing with bcrypt
- Optional device tokens for push notifications

### 🏥 Patient Features
- Find nearby healthcare services (location-based)
- Book appointments with doctors, nurses, pathology labs
- Request ambulance services
- Order medicines from pharmacies
- Request blood from blood banks
- Track booking status in real-time
- Cancel bookings with reason
- Rate and review completed services
- View booking history with pagination

### 👨‍⚕️ Provider Features (Doctor, Nurse, Ambulance, etc.)
- Update professional profile
- Set availability schedule
- Accept/reject booking requests
- Update booking status (on_the_way, in_progress, completed)
- Create prescriptions (doctors)
- Upload reports (pathology labs)
- Manage inventory (pharmacies, blood banks)
- Dashboard with stats and analytics

### 📱 Notifications
- **Push Notifications** (Firebase Cloud Messaging for mobile)
- **SMS Notifications** (Twilio integration)
- **Email Notifications** (Optional)
- Booking confirmations, status updates, emergency alerts
- Background job processing with BullMQ

### 🌍 Location Services
- Geospatial queries (MongoDB 2dsphere)
- Find services within radius
- Real-time location tracking for ambulances
- Distance calculation and ETA estimation

### 🚨 Emergency Features
- Priority emergency bookings
- Instant notification to nearby providers
- Rate limiting to prevent abuse
- Emergency contact management

---

## 🛠 Tech Stack

### Core
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Database**: MongoDB 7.x (with Mongoose ODM)
- **Cache/Queue**: Redis + BullMQ

### Authentication & Security
- **JWT**: jsonwebtoken
- **Password Hashing**: bcryptjs
- **Rate Limiting**: express-rate-limit
- **CORS**: cors middleware

### Notifications
- **Push**: Firebase Admin SDK
- **SMS**: Twilio
- **Queue**: BullMQ (background jobs)

### Validation & Logging
- **Validation**: Joi
- **Logging**: Winston
- **Environment**: dotenv

### Development
- **Auto-reload**: Nodemon
- **Module System**: ES Modules (type: "module")

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT APPS                           │
│          (Mobile - React Native / Web - Next.js)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS / REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    EXPRESS SERVER                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Layer                                    │   │
│  │  - CORS  - Cookie Parser  - Rate Limiting            │   │
│  │  - Body Parser  - Auth Middleware                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes Layer                                        │   │
│  │  /auth  /patient  /doctor  /nurse  /ambulance        │   │
│  │  /pharmacist  /bloodbank  /pathology  /video /admin  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controllers                                         │   │
│  │  - Business logic  - Request validation              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services                                            │   │
│  │  - Booking  - Notification  - Location  - Firebase   │   │
│  │  - SMS  - Video                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Models (Mongoose)                                   │   │
│  │  - User  - Booking  - Notification  - Prescription   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────┬───────────────┘
                      │                       │
          ┌───────────▼──────────┐    ┌──────▼───────────┐
          │   MongoDB Atlas      │    │   Redis Cloud    │
          │   (Primary DB)       │    │   (Queue/Cache)  │
          └──────────────────────┘    └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                              │
├──────────────────┬─────────────────┬────────────────────────┤
│  Firebase FCM    │   Twilio SMS    │   Video Service        │
│  (Push Notify)   │   (Text Notify) │   (Consultations)      │
└──────────────────┴─────────────────┴────────────────────────┘
```

### MVC Pattern
```
routes/ ──→ controllers/ ──→ services/ ──→ models/
             (business       (reusable    (database
              logic)          functions)   schemas)
```

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required
Node.js >= 18.0.0
MongoDB >= 7.0
Redis >= 6.0

# Optional (for full features)
Firebase Project (push notifications)
Twilio Account (SMS notifications)
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ourdeals-backend.git
cd ourdeals-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

4. **Start MongoDB & Redis**
```bash
# MongoDB
mongod --dbpath /path/to/data

# Redis
redis-server
```

5. **Run the application**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5000`

---

## ⚙️ Environment Setup

### Environment Variables

```env
# Server Configuration
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ourdeals

# JWT Secrets
JWT_SECRET=your_super_secret_key_change_in_production
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS Origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://yourapp.com

# Firebase (Mobile Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Twilio (SMS Notifications)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Redis (Background Jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Required vs Optional

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | ❌ | Server port (default: 5000) |
| `MONGODB_URI` | ✅ | Database connection |
| `JWT_SECRET` | ✅ | Token signing |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing |
| `CORS_ORIGIN` | ❌ | Allowed origins (default: localhost:5173) |
| Firebase vars | ❌ | Only for mobile push |
| Twilio vars | ❌ | Only for SMS notifications |
| Redis vars | ❌ | Only for background jobs |

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:5000/api/v1
Production: https://api.yourapp.com/api/v1
```

### Authentication

All protected routes require the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### API Endpoints Overview

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Auth** | 8 | Register, login, refresh, logout, profile |
| **Patient** | 11 | Search services, bookings, notifications |
| **Doctor** | 6 | Appointments, prescriptions, availability |
| **Ambulance** | 9 | Ride requests, location tracking, ETA |
| **Nurse** | 8 | Bookings, services, home visits |
| **Pharmacist** | 10 | Medicine inventory, orders, delivery |
| **Blood Bank** | 7 | Blood stock, requests, fulfillment |
| **Pathology** | 7 | Test bookings, sample collection, reports |
| **Video** | 3 | Video consultations, sessions |
| **Admin** | 7 | User management, approvals, dashboard |
| **Health** | 2 | Health check, status |

**Total**: 100+ endpoints

---

## 🔐 Authentication

### Registration

**Endpoint**: `POST /api/v1/auth/register`

**Request Body**:
```json
{
  "email": "patient@example.com",
  "password": "SecurePass@123",
  "role": "patient",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "9876543210",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "location": {
    "coordinates": [72.8777, 19.0760]
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "...",
      "email": "patient@example.com",
      "role": "patient",
      "firstName": "John",
      "lastName": "Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login

**Endpoint**: `POST /api/v1/auth/login`

**Request Body**:
```json
{
  "email": "patient@example.com",
  "password": "SecurePass@123"
}
```

### Device Token (Mobile Only)

**Endpoint**: `POST /api/v1/auth/device-token`

**Request Body**:
```json
{
  "deviceToken": "firebase_device_token_here"
}
```

> **Note**: Web apps can skip this step. Device token is optional.

### Logout

**Endpoint**: `POST /api/v1/auth/logout`

**Request Body** (optional):
```json
{
  "deviceToken": "firebase_device_token_here"
}
```

---

## 🏥 Patient Endpoints

### Find Nearby Services

**Endpoint**: `GET /api/v1/patient/services/nearby`

**Query Parameters**:
```
?serviceType=doctor
&latitude=19.0760
&longitude=72.8777
&radius=5
&specialization=cardiologist
```

**Response**:
```json
{
  "success": true,
  "message": "Services found",
  "data": [
    {
      "_id": "...",
      "firstName": "Dr. Smith",
      "specialization": "Cardiologist",
      "rating": {
        "average": 4.8,
        "count": 125
      },
      "location": {
        "coordinates": [72.8777, 19.0760]
      },
      "distance": 2.3
    }
  ]
}
```

### Create Booking

**Endpoint**: `POST /api/v1/patient/bookings`

**Request Body**:
```json
{
  "serviceType": "doctor",
  "providerId": "provider_id_here",
  "scheduledTime": "2026-02-15T10:00:00Z",
  "symptoms": "Fever, headache",
  "notes": "Patient has been feeling unwell for 2 days",
  "location": {
    "address": "123 Main St, Mumbai",
    "coordinates": [72.8777, 19.0760]
  },
  "price": 500
}
```

### Get My Bookings

**Endpoint**: `GET /api/v1/patient/bookings`

**Query Parameters**:
```
?page=1&limit=10&status=completed
```

### Trigger Emergency

**Endpoint**: `POST /api/v1/patient/emergency`

**Request Body**:
```json
{
  "location": {
    "coordinates": [72.8777, 19.0760]
  },
  "serviceType": "ambulance",
  "notes": "Heart attack suspected, urgent!"
}
```

> **Note**: Rate limited to prevent abuse (max 3 requests per 10 minutes)

---

## 👨‍⚕️ Provider Endpoints

### Doctor - Update Availability

**Endpoint**: `PUT /api/v1/doctor/availability`

**Request Body**:
```json
{
  "availability": [
    {
      "day": "Monday",
      "slots": [
        {"start": "09:00", "end": "12:00"},
        {"start": "14:00", "end": "17:00"}
      ]
    },
    {
      "day": "Tuesday",
      "slots": [
        {"start": "10:00", "end": "13:00"}
      ]
    }
  ]
}
```

### Ambulance - Update Location

**Endpoint**: `PUT /api/v1/ambulance/location`

**Request Body**:
```json
{
  "location": {
    "coordinates": [72.8812, 19.0785]
  }
}
```

### Pharmacist - Add Medicine

**Endpoint**: `POST /api/v1/pharmacist/medicines`

**Request Body**:
```json
{
  "name": "Paracetamol 500mg",
  "manufacturer": "ABC Pharma",
  "price": 50,
  "stock": 100,
  "category": "Pain Relief",
  "prescriptionRequired": false
}
```

### Pathology - Upload Report

**Endpoint**: `POST /api/v1/pathology/bookings/:id/report`

**Content-Type**: `multipart/form-data`

**Form Data**:
```
report: <file>
```

---

## 🎯 Admin Endpoints

### Get All Users

**Endpoint**: `GET /api/v1/admin/users`

**Query Parameters**:
```
?role=doctor&status=pending&page=1&limit=20
```

### Approve Provider

**Endpoint**: `POST /api/v1/admin/providers/:id/approve`

### Block User

**Endpoint**: `POST /api/v1/admin/users/:id/block`

---

## 📊 Database Schema

### User Model

```javascript
{
  email: String (unique, required),
  password: String (hashed, required),
  role: Enum (required),
  firstName: String (required),
  lastName: String,
  phone: String (unique, required),
  city: String,
  state: String,
  pincode: String,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  deviceTokens: [String],  // For push notifications
  rating: {
    average: Number,
    count: Number
  },
  reviews: [{
    booking: ObjectId,
    patient: ObjectId,
    rating: Number,
    review: String,
    createdAt: Date
  }],
  isApproved: Boolean,
  isBlocked: Boolean,
  refreshToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Booking Model

```javascript
{
  patient: ObjectId (ref: User),
  provider: ObjectId (ref: User),
  serviceType: Enum (doctor, nurse, ambulance, etc.),
  status: Enum (requested, accepted, on_the_way, in_progress, completed, cancelled),
  scheduledTime: Date,
  startTime: Date,
  endTime: Date,
  estimatedArrival: Date,
  duration: Number (minutes),
  location: {
    address: String,
    coordinates: [longitude, latitude]
  },
  notes: String,
  price: Number,
  paymentStatus: Enum (pending, paid, refunded),
  paymentMethod: Enum (cash, online),
  cancellationReason: String,
  cancelledBy: ObjectId,
  prescription: ObjectId (ref: Prescription),
  report: String (URL),
  isEmergency: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Model

```javascript
{
  user: ObjectId (ref: User),
  type: Enum,
  title: String,
  message: String,
  data: Object,
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
}
```

### Indexes

**User**:
- `location: "2dsphere"` (geospatial queries)
- `email: 1` (unique)
- `phone: 1` (unique)

**Booking**:
- `{ patient: 1, createdAt: -1 }`
- `{ provider: 1, status: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ isEmergency: 1, createdAt: -1 }`

---

## 🔔 Notification System

### Types of Notifications

1. **Push Notifications** (Mobile - Firebase)
2. **SMS Notifications** (Twilio)
3. **In-App Notifications** (Database)

### Notification Flow

```
Event Trigger
    ↓
notificationService.sendXXX()
    ↓
addNotificationToQueue()
    ↓
Redis Queue (BullMQ)
    ↓
Notification Worker
    ↓
┌───────────┬──────────────┬──────────────┐
│ Firebase  │   Twilio     │   Database   │
│ (Push)    │   (SMS)      │   (In-App)   │
└───────────┴──────────────┴──────────────┘
```

### Supported Notification Types

```javascript
NOTIFICATION_TYPES = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_ACCEPTED: 'booking_accepted',
  BOOKING_CANCELLED: 'booking_cancelled',
  PROVIDER_ARRIVING: 'provider_arriving',
  EMERGENCY_TRIGGERED: 'emergency_triggered',
  PRESCRIPTION_READY: 'prescription_ready',
  REPORT_UPLOADED: 'report_uploaded',
  PAYMENT_RECEIVED: 'payment_received'
}
```

---

## ⚡ Background Jobs

### Queue System (BullMQ + Redis)

**Queue Name**: `notifications`

**Job Options**:
```javascript
{
  attempts: 3,              // Retry 3 times on failure
  backoff: {
    type: 'exponential',
    delay: 1000             // 1s, 2s, 4s
  },
  removeOnComplete: true,   // Clean up successful jobs
  removeOnFail: false       // Keep failed jobs for debugging
}
```

### Worker Processing

Location: `src/queue/notification.worker.js`

Handles:
- ✅ Push notifications (Firebase)
- ✅ SMS notifications (Twilio)
- ✅ Email notifications (optional)

---

## 🧪 Testing

### Postman Collection

Import: `OurDeals-API-Complete.postman_collection.json`

**Collection includes**:
- Pre-configured requests for all endpoints
- Environment variables (baseUrl, accessToken, refreshToken)
- Auto-save tokens from login response
- Example request bodies

### Test Flow

1. **Register a Patient**
   ```
   POST /auth/register (role: patient)
   ```

2. **Register a Doctor**
   ```
   POST /auth/register (role: doctor)
   ```

3. **Login as Patient**
   ```
   POST /auth/login
   → Saves accessToken automatically
   ```

4. **Find Nearby Doctors**
   ```
   GET /patient/services/nearby?serviceType=doctor&latitude=19.0760&longitude=72.8777
   ```

5. **Create Booking**
   ```
   POST /patient/bookings
   ```

6. **Login as Doctor**
   ```
   POST /auth/login (doctor credentials)
   ```

7. **Accept Booking**
   ```
   POST /doctor/appointments/:id/accept
   ```

8. **Update Status to Completed**
   ```
   POST /doctor/appointments/:id/status
   ```

9. **Add Rating**
   ```
   POST /patient/bookings/:id/rate
   ```

---

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
```

**Build & Run**:
```bash
docker build -t ourdeals-backend .
docker run -p 5000:5000 --env-file .env ourdeals-backend
```

### Manual Deployment

1. **Setup Production Server** (Ubuntu/Debian)
   ```bash
   sudo apt update
   sudo apt install nodejs npm mongodb-server redis-server
   ```

2. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd ourdeals-backend
   npm ci --only=production
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with production values
   ```

4. **Use PM2 for Process Management**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name ourdeals-backend
   pm2 save
   pm2 startup
   ```

5. **Setup Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name api.yourapp.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## 📦 Project Structure

```
ourdeals-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── env.config.js
│   │   └── redis.js
│   ├── controller/          # Request handlers
│   │   ├── auth.controller.js
│   │   ├── patient.controller.js
│   │   ├── doctor.controller.js
│   │   └── ...
│   ├── middleware/          # Express middlewares
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── validation.middleware.js
│   │   └── rate-limit.middleware.js
│   ├── models/              # Mongoose schemas
│   │   ├── User.model.js
│   │   ├── Booking.model.js
│   │   ├── Notification.model.js
│   │   └── ...
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── patient.routes.js
│   │   └── ...
│   ├── services/            # Business logic
│   │   ├── booking.service.js
│   │   ├── notification.service.js
│   │   ├── firebase.service.js
│   │   └── ...
│   ├── queue/               # Background jobs
│   │   ├── notification.queue.js
│   │   └── notification.worker.js
│   ├── utils/               # Utility functions
│   │   ├── db.js
│   │   ├── logger.util.js
│   │   ├── response.util.js
│   │   └── ...
│   ├── validators/          # Joi schemas
│   │   └── schemas.js
│   ├── app.js               # Express app setup
│   └── index.js             # Entry point
├── .env.example             # Environment template
├── .gitignore
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the ISC License.

---

## 👤 Author

**Piyush Yadav**

---

## 📞 Support

For issues and queries:
- Create an issue on GitHub
- Email: support@ourdeals.com

---

## 🙏 Acknowledgments

- Firebase for push notifications
- Twilio for SMS services
- MongoDB for flexible database
- Express.js community

---

**Made with ❤️ for better healthcare accessibility**
