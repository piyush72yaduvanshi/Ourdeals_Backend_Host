import "./config/env.config.js";
import http from "http";
import app from "./app.js";
import { connectDatabase } from "./utils/db.js";
import { initializeSocket } from "./socket/socket.handler.js";

const PORT = process.env.PORT || 5000;

// FIXED: Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't exit immediately - let current requests finish
  setTimeout(() => {
    console.error('Shutting down due to unhandled rejection...');
    process.exit(1);
  }, 1000);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Exit immediately for uncaught exceptions
  process.exit(1);
});

// Create HTTP server
const server = http.createServer(app);

app.get("/user", (req, res) => {
  res.send("hello world");
});

app.get("/test-notification", async (req, res) => {
  try {
    const { notificationService } =
      await import("./services/notification.service.js");
    await notificationService.sendPush("fakeUserId", "Test Title", "Test Body");
    res.send("Notification enqueued");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});
connectDatabase()
  .then(async () => {
    // Seed medicines on startup
    try {
      const { seedMedicines } = await import("./seeds/medicines.seed.js");
      await seedMedicines();
      console.log("✅ Medicine database seeded");
    } catch (err) {
      console.error("Failed to seed medicines", err);
    }
    
    // Initialize Socket.io
    initializeSocket(server);
    console.log("Socket.io initialized");

    // Initialize S3
    import("./services/s3.service.js")
      .then(({ s3Service }) => {
        s3Service.initializeS3();
        
        // Schedule periodic cleanup of temp files (every 30 minutes)
        setInterval(() => {
          s3Service.cleanupTempFiles();
        }, 30 * 60 * 1000); // 30 minutes
        
        console.log("S3 service initialized with scheduled cleanup");
      })
      .catch((err) => console.error("Failed to init S3", err));

    // Initialize AWS SNS for Push Notifications
    import("./services/firebase.service.js")
      .then(({ pushNotificationService }) => {
        pushNotificationService.initializePushNotifications();
      })
      .catch((err) => console.error("Failed to init Push Notifications", err));

    // Initialize AWS SQS Queue
    // Initialize AWS SQS Queue
    import("./queue/notification.queue.js")
      .then(({ initializeSQS }) => {
        initializeSQS();
      })
      .catch((err) => console.error("Failed to init SQS", err));

    // Initialize AWS SNS for SMS
    import("./services/sms.service.js")
      .then(({ smsService }) => {
        smsService.initializeSMS();
      })
      .catch((err) => console.error("Failed to init SMS", err));

    server.listen(PORT, () => {
      console.log(`Server is running on port http://localhost:${PORT}`);

      import("./queue/notification.worker.js")
        .then(({ initNotificationWorker }) => {
          initNotificationWorker();
        })
        .catch((err) =>
          console.error("Failed to init notification worker", err),
        );

      // Start cron jobs for meeting reminders
      import("./services/cron.service.js")
        .then(({ cronService }) => {
          cronService.start();
          console.log("Cron service started");
        })
        .catch((err) => console.error("Failed to start cron service", err));

      // Start periodic cleanup of expired bookings
      setInterval(async () => {
        try {
          const { realTimeBookingService } = await import("./services/realTimeBooking.service.js");
          await realTimeBookingService.expireOldBookings();
        } catch (err) {
          console.error("Failed to expire old bookings", err);
        }
      }, 5 * 60 * 1000); // Run every 5 minutes
    });
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });
