import { SNSClient, PublishCommand, CreatePlatformEndpointCommand } from "@aws-sdk/client-sns";
import { envConfig } from "../config/env.config.js";
import { logger } from "../utils/logger.util.js";

let snsClient = null;
let initialized = false;
let platformApplicationArn = null;

const initializePushNotifications = () => {
  if (initialized) return;

  try {
    const { region, accessKeyId, secretAccessKey, snsPlatformApplicationArn } = envConfig.aws;

    if (!region || !accessKeyId || !secretAccessKey) {
      logger.warn("AWS SNS credentials not configured. Push notifications disabled.");
      return;
    }

    snsClient = new SNSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    platformApplicationArn = snsPlatformApplicationArn;
    initialized = true;
    logger.info("🔥 AWS SNS Push Notifications initialized");
  } catch (error) {
    logger.error("AWS SNS Push init failed", { error: error.message });
  }
};

const sendPushNotification = async (deviceTokens = [], title, message, data = {}) => {
  if (!initialized) {
    logger.warn("AWS SNS not initialized. Skipping push notification.");
    return;
  }

  if (!Array.isArray(deviceTokens) || !deviceTokens.length) {
    logger.warn("No device tokens provided");
    return;
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const token of deviceTokens) {
    try {
      // Create message payload for mobile
      const payload = {
        default: message,
        GCM: JSON.stringify({
          notification: {
            title,
            body: message,
          },
          data,
        }),
        APNS: JSON.stringify({
          aps: {
            alert: {
              title,
              body: message,
            },
            sound: "default",
          },
          data,
        }),
      };

      const params = {
        Message: JSON.stringify(payload),
        MessageStructure: "json",
        TargetArn: token, // SNS endpoint ARN
      };

      const command = new PublishCommand(params);
      await snsClient.send(command);
      
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        token,
        error: error.message,
      });
      logger.error("Push notification failed for token", {
        error: error.message,
      });
    }
  }

  logger.info("Push notifications sent", {
    success: results.success,
    failed: results.failed,
  });

  return results;
};

const registerDeviceToken = async (deviceToken, platform = "GCM") => {
  if (!initialized || !platformApplicationArn) {
    throw new Error("AWS SNS not initialized or Platform Application ARN not configured");
  }

  try {
    const params = {
      PlatformApplicationArn: platformApplicationArn,
      Token: deviceToken,
    };

    const command = new CreatePlatformEndpointCommand(params);
    const response = await snsClient.send(command);

    logger.info("Device registered with SNS", {
      endpointArn: response.EndpointArn,
    });

    return response.EndpointArn;
  } catch (error) {
    logger.error("Device registration failed", { error: error.message });
    throw error;
  }
};

const sendToTopic = async (topic, title, message, data = {}) => {
  if (!initialized) {
    logger.warn("AWS SNS not initialized. Skipping topic push.");
    return;
  }

  try {
    const payload = {
      default: message,
      GCM: JSON.stringify({
        notification: {
          title,
          body: message,
        },
        data,
      }),
    };

    const params = {
      TopicArn: topic,
      Message: JSON.stringify(payload),
      MessageStructure: "json",
    };

    const command = new PublishCommand(params);
    await snsClient.send(command);

    logger.info(`Topic push sent → ${topic}`);
  } catch (error) {
    logger.error("Topic push failed", { error: error.message });
  }
};

export const pushNotificationService = {
  initializePushNotifications,
  sendPushNotification,
  registerDeviceToken,
  sendToTopic,
};