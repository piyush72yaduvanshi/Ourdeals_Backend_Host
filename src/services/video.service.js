/**
 * Video Call Service
 * Handles video consultation rooms using Twilio Video
 */

import twilio from 'twilio';
import { logger } from '../utils/logger.util.js';

class VideoService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.apiKeySid = process.env.TWILIO_API_KEY_SID;
    this.apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    
    // Initialize Twilio client only if credentials are provided
    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
      logger.info('Twilio Video Service initialized');
    } else {
      logger.warn('Twilio credentials not found. Video service will use mock mode.');
      this.client = null;
    }
  }

  /**
   * Create a video room for consultation
   * @param {string} bookingId - Unique booking ID
   * @param {string} type - Room type: 'group' or 'peer-to-peer'
   * @returns {Promise<Object>} Room details
   */
  async createRoom(bookingId, type = 'peer-to-peer') {
    try {
      if (!this.client) {
        // Mock mode for development
        logger.info(`[MOCK] Creating video room for booking: ${bookingId}`);
        return {
          sid: `RM${Date.now()}`,
          uniqueName: bookingId,
          status: 'in-progress',
          type: type,
          maxParticipants: 2,
          duration: 0,
          url: `https://video.twilio.com/v1/Rooms/RM${Date.now()}`,
          mock: true,
        };
      }

      const room = await this.client.video.v1.rooms.create({
        uniqueName: bookingId,
        type: type,
        maxParticipants: 2,
        recordParticipantsOnConnect: false, // Set to true if you want to record
        statusCallback: `${process.env.API_URL}/webhooks/twilio/room-status`,
      });

      logger.info(`Video room created: ${room.sid} for booking: ${bookingId}`);

      return {
        sid: room.sid,
        uniqueName: room.uniqueName,
        status: room.status,
        type: room.type,
        maxParticipants: room.maxParticipants,
        duration: room.duration,
        url: room.url,
      };
    } catch (error) {
      logger.error('Failed to create video room', { error: error.message, bookingId });
      throw new Error('Failed to create video room: ' + error.message);
    }
  }

  /**
   * Generate access token for a participant
   * @param {string} roomName - Room unique name (booking ID)
   * @param {string} identity - User identity (user ID)
   * @param {string} role - User role (patient/doctor)
   * @returns {string} Access token
   */
  generateAccessToken(roomName, identity, role = 'participant') {
    try {
      if (!this.apiKeySid || !this.apiKeySecret) {
        // Mock mode
        logger.info(`[MOCK] Generating access token for ${identity} in room ${roomName}`);
        return `mock_token_${identity}_${Date.now()}`;
      }

      const AccessToken = twilio.jwt.AccessToken;
      const VideoGrant = AccessToken.VideoGrant;

      // Create an access token
      const token = new AccessToken(
        this.accountSid,
        this.apiKeySid,
        this.apiKeySecret,
        {
          identity: identity,
          ttl: 3600, // Token valid for 1 hour
        }
      );

      // Create a video grant for this token
      const videoGrant = new VideoGrant({
        room: roomName,
      });

      token.addGrant(videoGrant);

      logger.info(`Access token generated for ${identity} in room ${roomName}`);

      return token.toJwt();
    } catch (error) {
      logger.error('Failed to generate access token', { error: error.message, identity, roomName });
      throw new Error('Failed to generate access token: ' + error.message);
    }
  }

  /**
   * Get room details
   * @param {string} roomSid - Room SID or unique name
   * @returns {Promise<Object>} Room details
   */
  async getRoom(roomSid) {
    try {
      if (!this.client) {
        // Mock mode
        return {
          sid: roomSid,
          status: 'in-progress',
          participants: [],
          mock: true,
        };
      }

      const room = await this.client.video.v1.rooms(roomSid).fetch();

      return {
        sid: room.sid,
        uniqueName: room.uniqueName,
        status: room.status,
        type: room.type,
        duration: room.duration,
        maxParticipants: room.maxParticipants,
      };
    } catch (error) {
      logger.error('Failed to get room details', { error: error.message, roomSid });
      throw new Error('Failed to get room details: ' + error.message);
    }
  }

  /**
   * Get participants in a room
   * @param {string} roomSid - Room SID
   * @returns {Promise<Array>} List of participants
   */
  async getParticipants(roomSid) {
    try {
      if (!this.client) {
        // Mock mode
        return [];
      }

      const participants = await this.client.video.v1
        .rooms(roomSid)
        .participants.list();

      return participants.map(p => ({
        sid: p.sid,
        identity: p.identity,
        status: p.status,
        startTime: p.startTime,
        duration: p.duration,
      }));
    } catch (error) {
      logger.error('Failed to get participants', { error: error.message, roomSid });
      throw new Error('Failed to get participants: ' + error.message);
    }
  }

  /**
   * End a video room
   * @param {string} roomSid - Room SID or unique name
   * @returns {Promise<Object>} Updated room details
   */
  async endRoom(roomSid) {
    try {
      if (!this.client) {
        // Mock mode
        logger.info(`[MOCK] Ending video room: ${roomSid}`);
        return {
          sid: roomSid,
          status: 'completed',
          mock: true,
        };
      }

      const room = await this.client.video.v1
        .rooms(roomSid)
        .update({ status: 'completed' });

      logger.info(`Video room ended: ${room.sid}`);

      return {
        sid: room.sid,
        uniqueName: room.uniqueName,
        status: room.status,
        duration: room.duration,
      };
    } catch (error) {
      logger.error('Failed to end room', { error: error.message, roomSid });
      throw new Error('Failed to end room: ' + error.message);
    }
  }

  /**
   * Get room recordings (if recording was enabled)
   * @param {string} roomSid - Room SID
   * @returns {Promise<Array>} List of recordings
   */
  async getRecordings(roomSid) {
    try {
      if (!this.client) {
        // Mock mode
        return [];
      }

      const recordings = await this.client.video.v1
        .rooms(roomSid)
        .recordings.list();

      return recordings.map(r => ({
        sid: r.sid,
        status: r.status,
        duration: r.duration,
        size: r.size,
        url: r.url,
        dateCreated: r.dateCreated,
      }));
    } catch (error) {
      logger.error('Failed to get recordings', { error: error.message, roomSid });
      throw new Error('Failed to get recordings: ' + error.message);
    }
  }

  /**
   * Create a video consultation session
   * @param {string} bookingId - Booking ID
   * @param {string} patientId - Patient user ID
   * @param {string} doctorId - Doctor user ID
   * @returns {Promise<Object>} Session details with tokens
   */
  async createConsultationSession(bookingId, patientId, doctorId) {
    try {
      // Create room
      const room = await this.createRoom(bookingId, 'peer-to-peer');

      // Generate tokens for both participants
      const patientToken = this.generateAccessToken(bookingId, patientId, 'patient');
      const doctorToken = this.generateAccessToken(bookingId, doctorId, 'doctor');

      logger.info(`Consultation session created for booking: ${bookingId}`);

      return {
        roomSid: room.sid,
        roomName: bookingId,
        patientToken,
        doctorToken,
        status: room.status,
        expiresIn: 3600, // 1 hour
      };
    } catch (error) {
      logger.error('Failed to create consultation session', { error: error.message, bookingId });
      throw new Error('Failed to create consultation session: ' + error.message);
    }
  }

  /**
   * Check if video service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null;
  }

  /**
   * Get service status
   * @returns {Object}
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'production' : 'mock',
      provider: 'Twilio Video',
    };
  }
}

// Export singleton instance
export const videoService = new VideoService();
