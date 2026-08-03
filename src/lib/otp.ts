import { createServerFn } from "@tanstack/react-start";
import nodemailer from "nodemailer";  
import crypto from "node:crypto";

export interface SendOtpInput {
  email: string;
}

export interface SendOtpResult {
  success: boolean;
  message: string;
  expiresAt?: number;
  cooldownSeconds?: number;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  email?: string;
  verifiedAt?: string;
}

interface OtpRecord {
  otpHash: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

// In-memory OTP storage (persists while server is running)
const otpMap = new Map<string, OtpRecord>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL as required
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds resend timer
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/** Create a Nodemailer transporter using environment variables */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function renderEmailHtml(otp: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8; margin: 0; padding: 30px 15px; }
          .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #4F46E5 0%, #10B981 100%); padding: 32px 24px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 24px; text-align: center; }
          .content p { color: #4b5563; font-size: 15px; line-height: 1.5; margin-top: 0; }
          .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #111827; background: #f3f4f6; padding: 18px 24px; border-radius: 14px; margin: 24px 0; display: inline-block; font-family: monospace; }
          .footer { padding: 20px 24px; text-align: center; background: #fafafa; border-top: 1px solid #f0f0f0; font-size: 12px; color: #9ca3af; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">CampusRide AI</span>
            <h1>Email Verification</h1>
          </div>
          <div class="content">
            <p>Welcome to <strong>CampusRide AI</strong>! Use the code below to verify your university email (<code>${email}</code>):</p>
            <div class="otp-code">${otp}</div>
            <p style="font-size: 13px; color: #6b7280;">This code is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
          </div>
          <div class="footer">
            CampusRide AI — Verified University Ride Sharing<br/>
            If you did not request this email, you can safely ignore it.
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Server Function: Send real OTP email to user's inbox
 */
export const sendOtp = createServerFn({ method: "POST" })
  .validator((data: SendOtpInput) => {
    if (!data || typeof data.email !== "string") {
      throw new Error("Invalid email input.");
    }
    const email = normalizeEmail(data.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid university email address.");
    }
    return { email };
  })
  .handler(async ({ data }): Promise<SendOtpResult> => {
    const { email } = data;
    const now = Date.now();
    const existing = otpMap.get(email);

    // 30-second resend cooldown check
    if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSec} seconds before requesting a new code.`,
        cooldownSeconds: waitSec,
      };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return {
        success: false,
        message: "Email service not configured. Please set SMTP credentials in environment variables.",
      };
    }

    const otp = generateOtp();
    const expiresAt = now + OTP_TTL_MS;

    try {
      const from =
        process.env.SMTP_FROM ||
        `"CampusRide AI" <${process.env.SMTP_USER || process.env.SMTP_EMAIL}>`;

      await transporter.sendMail({
        from,
        to: email,
        subject: `Your CampusRide AI Verification Code: ${otp}`,
        text: `Your CampusRide AI verification code is ${otp}. Valid for 5 minutes.`,
        html: renderEmailHtml(otp, email),
      });

      // Save OTP record only after email is sent successfully
      const record: OtpRecord = {
        otpHash: hashOtp(otp),
        expiresAt,
        lastSentAt: now,
        attempts: 0,
      };
      otpMap.set(email, record);

      return {
        success: true,
        message: "OTP sent successfully to your inbox.",
        expiresAt,
      };
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[CampusRide SMTP Error]:", detail);
      return {
        success: false,
        message: "Failed to deliver OTP email to your inbox. Please verify email address or SMTP credentials.",
      };
    }
  });

/**
 * Server Function: Verify OTP entered by user
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((data: VerifyOtpInput) => {
    if (!data || typeof data.email !== "string" || typeof data.otp !== "string") {
      throw new Error("Invalid request parameters.");
    }
    const email = normalizeEmail(data.email);
    const otp = data.otp.trim();
    if (!email || !otp) {
      throw new Error("Email and OTP code are required.");
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new Error("OTP code must be 6 digits.");
    }
    return { email, otp };
  })
  .handler(async ({ data }): Promise<VerifyOtpResult> => {
    const { email, otp } = data;
    const now = Date.now();
    const record = otpMap.get(email);

    if (!record) {
      return {
        success: false,
        message: "No OTP request found. Please request a new verification code.",
      };
    }

    if (now > record.expiresAt) {
      otpMap.delete(email);
      return {
        success: false,
        message: "OTP expired. Please request a new verification code.",
      };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      otpMap.delete(email);
      return {
        success: false,
        message: "Too many failed attempts. Please request a new verification code.",
      };
    }

    const inputHash = hashOtp(otp);
    if (inputHash !== record.otpHash) {
      record.attempts += 1;
      const remaining = MAX_ATTEMPTS - record.attempts;
      return {
        success: false,
        message: `Invalid OTP code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`,
      };
    }

    // OTP verified successfully -> clear OTP record to prevent reuse
    otpMap.delete(email);

    return {
      success: true,
      message: "Email verified successfully!",
      email,
      verifiedAt: new Date().toISOString(),
    };
  });
