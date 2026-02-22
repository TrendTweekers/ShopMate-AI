/**
 * email.server.ts
 *
 * Thin wrapper around nodemailer. Reads SMTP config from environment variables:
 *
 *   SMTP_HOST      – e.g. "smtp.gmail.com" or "smtp.sendgrid.net"
 *   SMTP_PORT      – e.g. "587" (TLS) or "465" (SSL). Defaults to 587.
 *   SMTP_USER      – SMTP username / login
 *   SMTP_PASS      – SMTP password / API key
 *   SMTP_FROM      – "From" address, e.g. "ShopMate AI <noreply@stackedboost.com>"
 *
 * If SMTP_HOST is not set the function logs a warning and resolves without
 * sending — useful in dev where SMTP isn't configured.
 */

import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;

  if (!host) {
    console.warn("[email] SMTP_HOST not set — skipping email send. Subject:", subject);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `ShopMate AI <noreply@stackedboost.com>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
}

/**
 * Builds the HTML body for a feedback notification email.
 */
export function buildFeedbackEmail(opts: {
  shop: string;
  message: string;
  email: string | null;
  plan: string;
  timestamp: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#008060;margin:0 0 16px">📬 New ShopMate AI Feedback</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;border-radius:4px;font-weight:600;width:140px">Shop</td>
      <td style="padding:8px 12px">${escapeHtml(opts.shop)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:600">Plan</td>
      <td style="padding:8px 12px">${escapeHtml(opts.plan)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Merchant email</td>
      <td style="padding:8px 12px">${opts.email ? escapeHtml(opts.email) : "<em style='color:#6b7280'>not provided</em>"}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:600">Submitted at</td>
      <td style="padding:8px 12px">${escapeHtml(opts.timestamp)}</td>
    </tr>
  </table>
  <div style="margin-top:20px;padding:16px;background:#f9fafb;border-left:4px solid #008060;border-radius:4px">
    <p style="margin:0 0 6px;font-weight:600;font-size:14px">Message:</p>
    <p style="margin:0;font-size:14px;white-space:pre-wrap">${escapeHtml(opts.message)}</p>
  </div>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">
    This email was sent automatically by ShopMate AI when a merchant submitted feedback.
  </p>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
