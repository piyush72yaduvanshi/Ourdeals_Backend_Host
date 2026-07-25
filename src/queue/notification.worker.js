import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { envConfig } from "../config/env.config.js";
import { NOTIFICATION_TYPES } from "../utils/notificationTemplates.js";
import { User } from "../models/User.model.js";
import { pushNotificationService } from "../services/firebase.service.js";
import { smsService } from "../services/sms.service.js";
import { emailService } from "../services/email.service.js";
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

      // ─── EMAIL ────────────────────────────────────────────────────────────
      case NOTIFICATION_TYPES.EMAIL:
        try {
          const { to, subject, htmlBody, textBody, template, templateData } = data;

          if (!to) {
            logger.warn("[SQS Worker] EMAIL skipped — no recipient address");
            break;
          }

          // Handle template-based emails
          if (template && templateData) {
            switch (template) {
              case "WELCOME":
                await emailService.sendWelcomeEmail(to, templateData.name, templateData.role);
                break;
              case "PASSWORD_RESET":
                await emailService.sendPasswordResetEmail(to, templateData.name, templateData.resetToken);
                break;
              case "BOOKING_CONFIRMATION":
                await emailService.sendBookingConfirmationEmail(to, templateData.name, templateData);
                break;
              case "PAYMENT_CONFIRMATION":
                await emailService.sendPaymentConfirmationEmail(to, templateData.name, templateData);
                break;
              case "ACCOUNT_DELETION":
                await emailService.sendAccountDeletionEmail(to, templateData.name, templateData.confirmationLink);
                break;
              case "MEETING_REMINDER":
                await emailService.sendMeetingReminderEmail(to, templateData.name, templateData);
                break;
              case "OTP":
                await emailService.sendOTPEmail(to, templateData.name, templateData.otp, templateData.purpose);
                break;
              default:
                // Fallback: send raw email
                if (subject && htmlBody) {
                  await emailService.sendEmail(to, subject, htmlBody, textBody);
                } else {
                  logger.warn(`[SQS Worker] EMAIL unknown template: ${template}`);
                }
            }
          } else if (subject && htmlBody) {
            // Raw email (no template)
            await emailService.sendEmail(to, subject, htmlBody, textBody);
          } else {
            logger.warn("[SQS Worker] EMAIL skipped — missing subject or body", { to });
            break;
          }

          logger.info(`[SQS Worker] EMAIL sent to ${to}`);
        } catch (err) {
          logger.error(`[SQS Worker] EMAIL failed: ${err.message}`, { to: data?.to });
          throw err;
        }
        break;

      // ─── PUSH ─────────────────────────────────────────────────────────────
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

      // ─── SMS ──────────────────────────────────────────────────────────────
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
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 30,
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
