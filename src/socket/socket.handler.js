import { Server } from "socket.io";
import { tokenService } from "../services/token.service.js";
import { Booking } from "../models/Booking.model.js";
import { logger } from "../utils/logger.util.js";

class SocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.setupMiddleware();
    this.setupConnectionHandler();
  }
  setupMiddleware() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;

        if (!token) {
          return next(new Error("Authentication error"));
        }

        const decoded = tokenService.verifyAccessToken(token);

        socket.userId = decoded.userId;
        socket.role = decoded.role;

        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });
  }

  setupConnectionHandler() {
    this.io.on("connection", (socket) => {
      logger.info(`Socket connected: ${socket.id}, User: ${socket.userId}`);

      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      socket.on("join:booking", (bookingId) => {
        socket.join(`booking:${bookingId}`);
        logger.info(`Socket ${socket.id} joined booking:${bookingId}`);
      });

      socket.on("leave:booking", (bookingId) => {
        socket.leave(`booking:${bookingId}`);
        logger.info(`Socket ${socket.id} left booking:${bookingId}`);
      });

      socket.on("location:update", async ({ bookingId, latitude, longitude }) => {
        try {
          if (!bookingId || !latitude || !longitude) return;

          // Try RealTimeBooking first (ambulance uses this)
          const { RealTimeBooking } = await import("../models/RealTimeBooking.model.js");
          let booking = await RealTimeBooking.findById(bookingId);

          if (!booking) {
            // Try legacy Booking model as fallback
            booking = await Booking.findById(bookingId);
          }

          if (!booking) {
            // Silently ignore - booking may have expired or been completed
            return;
          }

          const providerId = booking.acceptedProvider?.toString() || booking.provider?.toString();
          if (providerId && providerId !== socket.userId) {
            socket.emit("error", { message: "Unauthorized to update location" });
            return;
          }

          // Update location in database
          booking.providerLocation = {
            latitude,
            longitude,
            lastUpdated: new Date(),
          };
          await booking.save();

          // Emit to booking room
          this.io.to(`booking:${bookingId}`).emit("location:updated", {
            latitude,
            longitude,
            timestamp: new Date(),
          });

          logger.info(`Location updated for booking: ${bookingId}`);
        } catch (error) {
          logger.error("Location update failed", { error: error.message });
          // Don't emit error to client - silently fail on location updates
        }
      });

      socket.on("booking:status", ({ bookingId, status }) => {
        this.io.to(`booking:${bookingId}`).emit("booking:status:updated", {
          status,
          timestamp: new Date(),
        });
      });

      // Video call tracking events
      socket.on("call:doctor_join", async ({ bookingId }) => {
        try {
          const booking = await Booking.findById(bookingId);
          if (booking) {
            booking.doctor_on_call = true;
            await booking.save();
          }
          this.io.to(`booking:${bookingId}`).emit("call:doctor_joined", {
            bookingId,
            doctor_on_call: true,
            timestamp: new Date(),
          });
          logger.info(`Doctor joined call for booking: ${bookingId}`);
        } catch (error) {
          logger.error("Doctor join call failed", { error: error.message });
        }
      });

      socket.on("call:patient_join", async ({ bookingId }) => {
        try {
          const booking = await Booking.findById(bookingId);
          if (booking) {
            booking.patient_on_call = true;
            await booking.save();
          }
          this.io.to(`booking:${bookingId}`).emit("call:patient_joined", {
            bookingId,
            patient_on_call: true,
            timestamp: new Date(),
          });
          logger.info(`Patient joined call for booking: ${bookingId}`);
        } catch (error) {
          logger.error("Patient join call failed", { error: error.message });
        }
      });

      socket.on("disconnect", () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitToBooking(bookingId, event, data) {
    this.io.to(`booking:${bookingId}`).emit(event, data);
  }

  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  getIO() {
    return this.io;
  }
}

let socketHandler;

const initializeSocket = (server) => {
  socketHandler = new SocketHandler(server);
  return socketHandler;
};

const getSocketHandler = () => {
  if (!socketHandler) {
    throw new Error("Socket handler not initialized");
  }
  return socketHandler;
};

export { initializeSocket, getSocketHandler };
