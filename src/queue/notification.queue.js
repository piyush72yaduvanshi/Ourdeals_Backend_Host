import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { envConfig } from "../config/env.config.js";
import { logger } from "../utils/logger.util.js";

let sqsClient = null;
let queueUrl = null;
let initialized = false;

const initializeSQS = async () => {
  if (initialized) return;

  try {
    const { region, accessKeyId, secretAccessKey, sqsQueueName } = envConfig.aws;

    if (!region || !accessKeyId || !secretAccessKey || !sqsQueueName) {
      logger.info("ℹ AWS SQS credentials not configured. Queue disabled.");
      initialized = true; // Mark as initialized to prevent retry
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
    const getQueueUrlCommand = new GetQueueUrlCommand({
      QueueName: sqsQueueName,
    });

    const response = await sqsClient.send(getQueueUrlCommand);
    queueUrl = response.QueueUrl;

    initialized = true;
    logger.info("🔥 AWS SQS initialized", { queueUrl });
  } catch (error) {
    initialized = true; // Mark as initialized to prevent retry
    logger.info("ℹ AWS SQS not available - running without queue", { error: error.message });
  }
};

const addNotificationToQueue = async (type, data) => {
  if (!initialized || !queueUrl) {
    logger.warn("AWS SQS not initialized. Skipping queue.");
    return null;
  }

  try {
    const messageBody = {
      type,
      data,
      timestamp: new Date().toISOString(),
      attempts: 0,
    };

    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageAttributes: {
        NotificationType: {
          DataType: "String",
          StringValue: type,
        },
      },
    };

    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    logger.info("Message added to SQS queue", {
      messageId: response.MessageId,
      type,
    });

    return response.MessageId;
  } catch (error) {
    logger.error("Failed to add message to SQS", {
      error: error.message,
      type,
    });
    throw error;
  }
};

export { addNotificationToQueue, initializeSQS };
export default { addNotificationToQueue, initializeSQS };
