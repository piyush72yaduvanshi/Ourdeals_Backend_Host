/**
 * Zoom Video Service
 * Handles Zoom meeting creation and management
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.util.js';

class ZoomService {
  constructor() {
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    this.userId = process.env.ZOOM_USER_ID || 'me';
    
    this.accessToken = null;
    this.tokenExpiry = null;
    
    if (this.accountId && this.clientId && this.clientSecret) {
      logger.info('Zoom Service initialized');
    } else {
      logger.warn('Zoom credentials not found. Service will use mock mode.');
    }
  }

  /**
   * Get OAuth access token
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      if (!this.accountId || !this.clientId || !this.clientSecret) {
        // Mock mode
        return 'mock_zoom_token';
      }

      // Get new token
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`,
        {},
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      logger.info('Zoom access token obtained');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Zoom access token', { error: error.message });
      throw new Error('Failed to authenticate with Zoom: ' + error.message);
    }
  }

  /**
   * Create a Zoom meeting
   * @param {Object} options - Meeting options
   * @returns {Promise<Object>} Meeting details
   */
  async createMeeting(options = {}) {
    try {
      if (!this.accountId || !this.clientId || !this.clientSecret) {
        // Mock mode
        logger.info('[MOCK] Creating Zoom meeting');
        return {
          id: Date.now(),
          topic: options.topic || 'Healthcare Consultation',
          start_url: `https://zoom.us/s/mock_${Date.now()}`,
          join_url: `https://zoom.us/j/mock_${Date.now()}`,
          password: '123456',
          duration: options.duration || 30,
          mock: true,
        };
      }

      const token = await this.getAccessToken();

      const meetingData = {
        topic: options.topic || 'Healthcare Consultation',
        type: 2, // Scheduled meeting
        duration: options.duration || 30, // 30 minutes default
        timezone: 'Asia/Kolkata',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: false,
          audio: 'both',
          auto_recording: 'none', // Change to 'cloud' if you want recording
          approval_type: 2, // No registration required
        }
      };

      const response = await axios.post(
        `https://api.zoom.us/v2/users/${this.userId}/meetings`,
        meetingData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Zoom meeting created: ${response.data.id}`);

      return {
        id: response.data.id,
        topic: response.data.topic,
        start_url: response.data.start_url,
        join_url: response.data.join_url,
        password: response.data.password,
        duration: response.data.duration,
        start_time: response.data.start_time,
      };
    } catch (error) {
      logger.error('Failed to create Zoom meeting', { error: error.message });
      throw new Error('Failed to create Zoom meeting: ' + error.message);
    }
  }

  /**
   * Get meeting details
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object>} Meeting details
   */
  async getMeeting(meetingId) {
    try {
      if (!this.accountId || !this.clientId || !this.clientSecret) {
        // Mock mode
        return {
          id: meetingId,
          status: 'waiting',
          mock: true,
        };
      }

      // Validate meeting ID format
      if (!meetingId || typeof meetingId !== 'string') {
        throw new Error('Invalid meeting ID format');
      }

      const token = await this.getAccessToken();

      const response = await axios.get(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000, // 10 second timeout
        }
      );

      return {
        id: response.data.id,
        topic: response.data.topic,
        status: response.data.status,
        start_time: response.data.start_time,
        duration: response.data.duration,
        join_url: response.data.join_url,
      };
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        logger.error('Zoom API error response', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          meetingId,
        });
        
        // Handle specific Zoom API errors
        if (error.response.status === 404) {
          throw new Error('Meeting not found or has been deleted');
        } else if (error.response.status === 400) {
          throw new Error('Invalid meeting ID or request format');
        } else if (error.response.status === 401) {
          throw new Error('Zoom authentication failed');
        } else {
          throw new Error(`Zoom API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
        }
      } else if (error.request) {
        logger.error('Zoom API network error', { error: error.message, meetingId });
        throw new Error('Network error connecting to Zoom API');
      } else {
        logger.error('Failed to get Zoom meeting', { error: error.message, meetingId });
        throw new Error('Failed to get meeting details: ' + error.message);
      }
    }
  }

  /**
   * Delete a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMeeting(meetingId) {
    try {
      if (!this.accountId || !this.clientId || !this.clientSecret) {
        // Mock mode
        logger.info(`[MOCK] Deleting Zoom meeting: ${meetingId}`);
        return true;
      }

      const token = await this.getAccessToken();

      await axios.delete(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      logger.info(`Zoom meeting deleted: ${meetingId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete Zoom meeting', { error: error.message });
      throw new Error('Failed to delete meeting: ' + error.message);
    }
  }

  /**
   * Generate Zoom SDK JWT for client-side
   * @param {string} meetingNumber - Meeting number
   * @param {number} role - 0 for participant, 1 for host
   * @returns {string} JWT token
   */
  generateSDKJWT(meetingNumber, role = 0) {
    try {
      const sdkKey = this.clientId;
      const sdkSecret = this.clientSecret;

      if (!sdkKey || !sdkSecret) {
        return 'mock_sdk_jwt_token';
      }

      const payload = {
        sdkKey: sdkKey,
        mn: meetingNumber,
        role: role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // 2 hours
        tokenExp: Math.floor(Date.now() / 1000) + (60 * 60 * 2)
      };

      const token = jwt.sign(payload, sdkSecret);
      return token;
    } catch (error) {
      logger.error('Failed to generate SDK JWT', { error: error.message });
      throw new Error('Failed to generate SDK token: ' + error.message);
    }
  }

  /**
   * Create consultation session with meeting and tokens
   * @param {string} bookingId - Booking ID
   * @param {string} doctorName - Doctor name
   * @param {string} patientName - Patient name
   * @returns {Promise<Object>} Session details
   */
  async createConsultationSession(bookingId, doctorName, patientName) {
    try {
      // Create meeting
      const meeting = await this.createMeeting({
        topic: `Consultation: Dr. ${doctorName} & ${patientName}`,
        duration: 30
      });

      // Generate SDK tokens
      const hostToken = this.generateSDKJWT(meeting.id, 1); // Host (doctor)
      const participantToken = this.generateSDKJWT(meeting.id, 0); // Participant (patient)

      logger.info(`Consultation session created for booking: ${bookingId}`);

      return {
        meetingId: meeting.id,
        meetingPassword: meeting.password,
        hostStartUrl: meeting.start_url,
        joinUrl: meeting.join_url,
        hostToken,
        participantToken,
        sdkKey: this.clientId,
        duration: meeting.duration,
        expiresIn: 7200, // 2 hours
      };
    } catch (error) {
      logger.error('Failed to create consultation session', { error: error.message });
      throw new Error('Failed to create consultation session: ' + error.message);
    }
  }

  /**
   * Check if Zoom is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.accountId && this.clientId && this.clientSecret);
  }

  /**
   * Get service status
   * @returns {Object}
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'production' : 'mock',
      provider: 'Zoom',
      accountId: this.accountId ? `${this.accountId.substring(0, 8)}...` : 'not set',
    };
  }
}

// Export singleton instance
export const zoomService = new ZoomService();
