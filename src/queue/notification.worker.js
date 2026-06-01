import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { envConfig } from "../config/env.config.js";
import { NOTIFICATION_TYPES } from "../utils/notificationTemplates.js";
import { User } from "../models/User.model.js";
import { pushNotificationService } from "../services/firebase.service.js";
import { smsService } from "../services/sms.service.js";
import { logger } from "../utils/logger.util.js";

let sqsClient = null;
let queueUrl = null;
let isPolling = false;

const initializeWorker = async () => {
  try {
    const { region, accessKeyId, secretAccessKey, sqsQueueName } = envConfig.aws;

    if (!region || !accessKeyId || !secretAccessKey || !sqsQueueName) {
      logger.warn("AWS SQS credentials not configured. Worker disabled.");
      return;
    }

    sqsClient = new SQSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Get queue URL
    const { GetQueueUrlCommand } = await import("@aws-sdk/client-sqs");
    const getQueueUrlCommand = new GetQueueUrlCommand({
      QueueName: sqsQueueName,
    });

    const response = await sqsClient.send(getQueueUrlCommand);
    queueUrl = response.QueueUrl;

    logger.info("🔥 AWS SQS Worker initialized", { queueUrl });

    // Start polling
    startPolling();
  } catch (error) {
    logger.error("AWS SQS Worker init failed", { error: error.message });
  }
};

const processMessage = async (message) => {
  try {
    const body = JSON.parse(message.Body);
    const { type, data } = body;

    logger.info(`[SQS Worker] Processing message type: ${type}`);

    switch (type) {
      case NOTIFICATION_TYPES.EMAIL:
        logger.info(`[SQS Worker] Sending EMAIL to ${data.email}: ${data.subject}`);
        // Implement email service here
        break;

      case NOTIFICATION_TYPES.PUSH:
        try {
          const { userId, title, message: pushMessage, data: pushData } = data;
          const user = await User.findById(userId).select("deviceTokens");

          if (user?.deviceTokens?.length) {
            await pushNotificationService.sendPushNotification(
              user.deviceTokens,
              title,
              pushMessage,
              pushData || {}
            );
            logger.info(`[SQS Worker] PUSH sent to user ${userId}`);
          } else {
            logger.info(`[SQS Worker] No device tokens for user ${userId}`);
          }
        } catch (err) {
          logger.error(`[SQS Worker] PUSH failed: ${err.message}`);
          throw err;
        }
        break;

      case NOTIFICATION_TYPES.SMS:
        try {
          const { userId, message: smsMessage } = data;
          const user = await User.findById(userId).select("phone");

          if (user?.phone) {
            await smsService.sendSMS(user.phone, smsMessage);
            logger.info(`[SQS Worker] SMS sent to user ${userId}`);
          } else {
            logger.info(`[SQS Worker] No phone for user ${userId}`);
          }
        } catch (err) {
          logger.error(`[SQS Worker] SMS failed: ${err.message}`);
          throw err;
        }
        break;

      default:
        logger.warn(`[SQS Worker] Unknown notification type: ${type}`);
    }

    // Delete message from queue after successful processing
    await deleteMessage(message.ReceiptHandle);
  } catch (error) {
    logger.error("[SQS Worker] Failed to process message", {
      error: error.message,
    });
    // Message will be retried automatically by SQS
  }
};

const deleteMessage = async (receiptHandle) => {
  try {
    const params = {
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    };

    const command = new DeleteMessageCommand(params);
    await sqsClient.send(command);
    logger.info("[SQS Worker] Message deleted from queue");
  } catch (error) {
    logger.error("[SQS Worker] Failed to delete message", {
      error: error.message,
    });
  }
};

const pollMessages = async () => {
  if (!sqsClient || !queueUrl) return;

  try {
    const params = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10, // Process up to 10 messages at once
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 30, // 30 seconds to process
    };

    const command = new ReceiveMessageCommand(params);
    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      logger.info(`[SQS Worker] Received ${response.Messages.length} messages`);

      // Process messages in parallel
      await Promise.all(
        response.Messages.map((message) => processMessage(message))
      );
    }
  } catch (error) {
    logger.error("[SQS Worker] Polling error", { error: error.message });
  }

  // Continue polling
  if (isPolling) {
    setImmediate(pollMessages);
  }
};

const startPolling = () => {
  if (isPolling) return;
  isPolling = true;
  logger.info("[SQS Worker] Started polling for messages");
  pollMessages();
};

const stopPolling = () => {
  isPolling = false;
  logger.info("[SQS Worker] Stopped polling");
};

export const initNotificationWorker = initializeWorker;
export { stopPolling };
