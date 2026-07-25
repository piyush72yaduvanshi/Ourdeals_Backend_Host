import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { envConfig } from "../config/env.config.js";
import { logger } from "../utils/logger.util.js";

let sesClient = null;
let initialized = false;
let fromEmail = null;

/**
 * Initialize AWS SES client for sending emails
 */
const initializeEmail = () => {
  if (initialized) return;

  try {
    const { region, accessKeyId, secretAccessKey } = envConfig.aws;
    fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.AWS_SES_SENDER_EMAIL || "noreply@ourdeals.in";

    if (!region || !accessKeyId || !secretAccessKey) {
      logger.warn("AWS SES credentials not configured. Email disabled.");
      return;
    }

    sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    initialized = true;
    logger.info("🔥 AWS SES Email Service initialized", { fromEmail });
  } catch (error) {
    logger.error("AWS SES init failed", { error: error.message });
  }
};

/**
 * Send a plain email via AWS SES
 * @param {string} to - recipient email address
 * @param {string} subject - email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} textBody - plain text fallback
 */
const sendEmail = async (to, subject, htmlBody, textBody = null) => {
  if (!initialized || !sesClient) {
    logger.warn("AWS SES not initialized. Skipping email.", { to, subject });
    // Log the email content for development/debugging
    logger.info("📧 [EMAIL NOT SENT - SES DISABLED]", { to, subject, body: textBody || htmlBody });
    return null;
  }

  try {
    const params = {
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: htmlBody,
          },
          ...(textBody && {
            Text: {
              Charset: "UTF-8",
              Data: textBody,
            },
          }),
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
      Source: fromEmail,
    };

    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);

    logger.info("Email sent via AWS SES", {
      to,
      subject,
      messageId: response.MessageId,
    });

    return response.MessageId;
  } catch (error) {
    logger.error("AWS SES email send failed", {
      error: error.message,
      to,
      subject,
    });
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built email senders for all notification events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send welcome / registration confirmation email
 */
const sendWelcomeEmail = async (to, name, role = "user") => {
  const subject = "Welcome to OnMint Healthcare! 🎉";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#007bff; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">Welcome to OnMint Healthcare</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name}! 👋</h2>
        <p>Your <strong>${role}</strong> account has been successfully created.</p>
        <p>Our team will review your details and approve your account shortly. You'll receive a notification once approved.</p>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="color:#888; font-size:13px;">If you didn't create this account, please contact support immediately.</p>
      </div>
    </div>`;
  const text = `Welcome to OnMint Healthcare, ${name}! Your ${role} account has been created. We'll notify you once approved.`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send password reset email with reset link
 */
const sendPasswordResetEmail = async (to, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
  const subject = "Reset Your Password — OnMint Healthcare";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#dc3545; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">Password Reset Request</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name},</h2>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <div style="text-align:center; margin:30px 0;">
          <a href="${resetUrl}" 
             style="background:#007bff; color:white; padding:14px 30px; text-decoration:none; border-radius:5px; font-size:16px; display:inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color:#666;">Or copy this link into your browser:</p>
        <p style="word-break:break-all; color:#007bff;">${resetUrl}</p>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="color:#888; font-size:13px;">⚠️ This link expires in <strong>10 minutes</strong>. If you didn't request a password reset, please ignore this email.</p>
      </div>
    </div>`;
  const text = `Hi ${name}, reset your password here: ${resetUrl} (expires in 10 minutes)`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send booking confirmation email to patient
 */
const sendBookingConfirmationEmail = async (to, name, bookingDetails) => {
  const subject = `Booking Confirmed — ${bookingDetails.serviceType || "Service"} #${bookingDetails.bookingId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#28a745; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">✅ Booking Confirmed</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name},</h2>
        <p>Your <strong>${bookingDetails.serviceType || "service"}</strong> booking has been created successfully.</p>
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <tr style="background:#f8f9fa;">
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Booking ID</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${bookingDetails.bookingId}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Service</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${bookingDetails.serviceType || "General"}</td>
          </tr>
          ${bookingDetails.scheduledTime ? `
          <tr style="background:#f8f9fa;">
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Scheduled Time</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${new Date(bookingDetails.scheduledTime).toLocaleString("en-IN")}</td>
          </tr>` : ""}
          ${bookingDetails.amount ? `
          <tr>
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Amount</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">₹${bookingDetails.amount}</td>
          </tr>` : ""}
        </table>
        <p>We are searching for nearby providers and will notify you once someone accepts.</p>
      </div>
    </div>`;
  const text = `Hi ${name}, your ${bookingDetails.serviceType} booking (ID: ${bookingDetails.bookingId}) is confirmed. We'll notify you once a provider accepts.`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmationEmail = async (to, name, paymentDetails) => {
  const subject = `Payment Confirmed — ₹${paymentDetails.amount} for Booking #${paymentDetails.bookingId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#28a745; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">💳 Payment Confirmed</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name},</h2>
        <p>Your payment has been received successfully.</p>
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <tr style="background:#f8f9fa;">
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Booking ID</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${paymentDetails.bookingId}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Amount Paid</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6; color:#28a745; font-size:18px;"><strong>₹${paymentDetails.amount}</strong></td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Payment Method</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${paymentDetails.method || "Cash"}</td>
          </tr>
        </table>
        <p>Thank you for using OnMint Healthcare!</p>
      </div>
    </div>`;
  const text = `Hi ${name}, payment of ₹${paymentDetails.amount} confirmed for booking #${paymentDetails.bookingId}.`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send account deletion confirmation email
 */
const sendAccountDeletionEmail = async (to, name, confirmationLink) => {
  const subject = "Confirm Account Deletion — OnMint Healthcare";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#dc3545; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">⚠️ Account Deletion Request</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name},</h2>
        <p>We received a request to permanently delete your account. <strong>This action cannot be undone.</strong></p>
        <p>Click the button below to confirm deletion:</p>
        <div style="text-align:center; margin:30px 0;">
          <a href="${confirmationLink}" 
             style="background:#dc3545; color:white; padding:14px 30px; text-decoration:none; border-radius:5px; font-size:16px; display:inline-block;">
            Confirm Account Deletion
          </a>
        </div>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="color:#888; font-size:13px;">⏳ This link expires in <strong>24 hours</strong>. If you didn't request account deletion, please contact support immediately.</p>
      </div>
    </div>`;
  const text = `Hi ${name}, confirm your account deletion here: ${confirmationLink} (expires in 24 hours). If you didn't request this, contact support.`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send OTP / verification email
 */
const sendOTPEmail = async (to, name, otp, purpose = "verification") => {
  const subject = `Your OTP for ${purpose} — OnMint Healthcare`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#007bff; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">Your OTP Code</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px; text-align:center;">
        <h2>Hi ${name},</h2>
        <p>Your OTP for <strong>${purpose}</strong> is:</p>
        <div style="background:#f8f9fa; border:2px dashed #007bff; padding:20px; border-radius:8px; margin:20px 0;">
          <span style="font-size:36px; font-weight:bold; color:#007bff; letter-spacing:8px;">${otp}</span>
        </div>
        <p style="color:#666;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <p style="color:#888; font-size:13px;">Do not share this OTP with anyone.</p>
      </div>
    </div>`;
  const text = `Hi ${name}, your OTP for ${purpose} is: ${otp} (valid for 10 minutes). Do not share it.`;

  return sendEmail(to, subject, html, text);
};

/**
 * Send meeting reminder email (video consultation)
 */
const sendMeetingReminderEmail = async (to, name, meetingDetails) => {
  const subject = "Video Consultation Starting in 15 Minutes — OnMint Healthcare";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background:#f9f9f9;">
      <div style="background:#6f42c1; padding:30px; text-align:center; border-radius:8px 8px 0 0;">
        <h1 style="color:white; margin:0;">📹 Meeting Starting Soon!</h1>
      </div>
      <div style="background:white; padding:30px; border-radius:0 0 8px 8px;">
        <h2>Hi ${name},</h2>
        <p>Your video consultation is starting in <strong>15 minutes</strong>.</p>
        ${meetingDetails.meetingLink ? `
        <div style="text-align:center; margin:30px 0;">
          <a href="${meetingDetails.meetingLink}" 
             style="background:#6f42c1; color:white; padding:14px 30px; text-decoration:none; border-radius:5px; font-size:16px; display:inline-block;">
            Join Meeting Now
          </a>
        </div>` : ""}
        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
          <tr style="background:#f8f9fa;">
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Booking ID</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${meetingDetails.bookingId}</td>
          </tr>
          ${meetingDetails.scheduledTime ? `
          <tr>
            <td style="padding:10px; border:1px solid #dee2e6;"><strong>Scheduled At</strong></td>
            <td style="padding:10px; border:1px solid #dee2e6;">${new Date(meetingDetails.scheduledTime).toLocaleString("en-IN")}</td>
          </tr>` : ""}
        </table>
      </div>
    </div>`;
  const text = `Hi ${name}, your video consultation starts in 15 minutes. Join here: ${meetingDetails.meetingLink || "Check the app"}`;

  return sendEmail(to, subject, html, text);
};

export const emailService = {
  initializeEmail,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendAccountDeletionEmail,
  sendOTPEmail,
  sendMeetingReminderEmail,
};
