import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { logger } from "../utils/logger.util.js";

let snsClient = null;
let initialized = false;

const initializeSMS = () => {
  if (initialized) return;

  try {
    const awsRegion = process.env.AWS_REGION;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
      logger.warn("AWS SNS credentials missing. SMS disabled.");
      return;
    }

    snsClient = new SNSClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    initialized = true;
    logger.info("🔥 AWS SNS initialized");
  } catch (error) {
    logger.error("AWS SNS init failed", {
      error: error.message,
    });
  }
};

const sendSMS = async (to, message) => {
  if (!initialized) {
    logger.warn("AWS SNS not initialized. Skipping SMS.");
    return;
  }

  try {
    // Format phone number for AWS SNS (must include country code)
    // If phone doesn't start with +, assume India (+91)
    let phoneNumber = to;
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+91${phoneNumber}`;
    }

    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: process.env.AWS_SNS_SENDER_ID || 'Healthcare',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Use 'Promotional' for marketing messages
        },
      },
    };

    const command = new PublishCommand(params);
    const response = await snsClient.send(command);

    logger.info(`SMS sent via AWS SNS → ${phoneNumber}`, {
      messageId: response.MessageId,
    });

    return response;
  } catch (error) {
    logger.error("AWS SNS SMS send failed", {
      error: error.message,
      to,
    });
    throw error;
  }
};

const sendEmergencySMS = async (to, emergencyDetails) => {
  const message = `🚨 EMERGENCY ALERT 🚨
${emergencyDetails}

This is an automated message from Healthcare Platform.`;

  await sendSMS(to, message);
};

const sendBulkSMS = async (phoneNumbers, message) => {
  if (!initialized) {
    logger.warn("AWS SNS not initialized. Skipping bulk SMS.");
    return;
  }

  const results = [];
  
  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendSMS(phoneNumber, message);
      results.push({ phoneNumber, success: true, messageId: result.MessageId });
    } catch (error) {
      results.push({ phoneNumber, success: false, error: error.message });
      logger.error(`Bulk SMS failed for ${phoneNumber}`, { error: error.message });
    }
  }

  logger.info(`Bulk SMS completed: ${results.filter(r => r.success).length}/${results.length} sent`);
  return results;
};

export const smsService = {
  initializeSMS,
  sendSMS,
  sendEmergencySMS,
  sendBulkSMS,
};
