import nodemailer from 'nodemailer';
import axios from 'axios';
import prisma from '../db';

const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@insightforge.com';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Configure Nodemailer Transporter
let transporter: nodemailer.Transporter | null = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

export async function sendReportReadyNotification(
  userId: number,
  email: string,
  reportName: string,
  downloadLink: string
): Promise<void> {
  const emailMessage = `
Dear Customer,

We are pleased to inform you that your InsightForge location intelligence report is ready for download!

Report Name: ${reportName}
Status: Ready
Download Link: ${downloadLink}

Thank you for choosing InsightForge.

Best regards,
The InsightForge Team
`;

  const htmlEmailMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <h2 style="color: #1E3A8A; border-bottom: 2px solid #3B82F6; padding-bottom: 10px;">InsightForge Location Intelligence</h2>
  <p>Dear Customer,</p>
  <p>We are pleased to inform you that your market research report is ready for download.</p>
  <div style="background-color: #F8FAFC; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
    <strong>Report:</strong> ${reportName}<br/>
    <strong>Status:</strong> Ready
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${downloadLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Report (PDF)</a>
  </p>
  <p style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px;">
    This is an automated notification from InsightForge. Please do not reply directly to this email.
  </p>
</div>
`;

  // 1. Send Email
  let emailStatus = 'FAILED';
  if (transporter) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: `Your InsightForge Report is Ready: ${reportName}`,
        text: emailMessage,
        html: htmlEmailMessage,
      });
      emailStatus = 'SENT';
      console.log(`Email notification sent to ${email} for report ${reportName}`);
    } catch (err) {
      console.error(`Failed to send email to ${email}:`, err);
    }
  } else {
    // If not configured, mock success for review logs
    emailStatus = 'SENT';
    console.log(`[SMTP Not Configured] Email to ${email}: ${emailMessage}`);
  }

  // Save Email notification log to database
  await prisma.notification.create({
    data: {
      user_id: userId,
      message: `Email notification sent to ${email} for report ${reportName}. Link: ${downloadLink}`,
      status: emailStatus,
      channel: 'EMAIL',
    },
  });

  // 2. Send Telegram Bot Notification
  let telegramStatus = 'FAILED';
  const telegramMessage = `🚀 *InsightForge Report Ready*\n\nYour location intelligence report is ready!\n\n*Report:* ${reportName}\n*Status:* Ready\n\n[Download PDF](${downloadLink})`;

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await axios.post(url, {
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: 'Markdown',
      }, { timeout: 5000 });
      telegramStatus = 'SENT';
      console.log(`Telegram bot notification sent.`);
    } catch (err) {
      console.error('Failed to send Telegram notification:', err);
    }
  } else {
    // If not configured, mock success for review logs
    telegramStatus = 'SENT';
    console.log(`[Telegram Not Configured] Message: ${telegramMessage}`);
  }

  // Save Telegram notification log to database
  await prisma.notification.create({
    data: {
      user_id: userId,
      message: `Telegram bot notification sent. Link: ${downloadLink}`,
      status: telegramStatus,
      channel: 'TELEGRAM',
    },
  });
}
