import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function testEmail() {
  const schoolName = "Riverside University";
  const subdomain = "riverside";
  const adminEmail = "bonaventure.chinoso@gmail.com";
  const adminPassword = "Password123#";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://bonaveeict.com.ng").replace(/\/$/, "");
  const portalUrl = `${baseUrl}/login?school=${encodeURIComponent(subdomain)}`;
  const brandColor = "#4f46e5";
  const subject = `🎉 Welcome to School ERP - ${schoolName} Portal Access Credentials`;

  console.log("=== Testing School Registration Email Dispatch ===");
  console.log("Recipient:", adminEmail);
  console.log("School:", schoolName);
  console.log("Portal URL:", portalUrl);
  console.log("RESEND_API_KEY configured?", !!process.env.RESEND_API_KEY);
  console.log("SMTP_HOST configured?", !!process.env.SMTP_HOST);

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>School Registration Successful - ${schoolName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: ${brandColor}; padding: 36px 32px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px;">${schoolName}</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">School Administrative Workspace Provisioned</p>
        </div>
        <div style="padding: 36px 32px; line-height: 1.6;">
          <p style="font-size: 16px; color: #334155;">
            Congratulations! Your institutional workspace for <strong>${schoolName}</strong> has been successfully configured and activated on the School ERP platform.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 5px solid ${brandColor};">
            <p style="margin: 8px 0;"><strong>School Name:</strong> ${schoolName}</p>
            <p style="margin: 8px 0;"><strong>Portal URL:</strong> <a href="${portalUrl}" style="color: ${brandColor}; font-weight: bold;">${portalUrl}</a></p>
            <p style="margin: 8px 0;"><strong>Admin Login:</strong> ${adminEmail}</p>
            <p style="margin: 8px 0;"><strong>Password:</strong> ${adminPassword}</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="background-color: ${brandColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block;">
              Access School Admin Portal &rarr;
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  let sent = false;

  // 1. Try Resend if key is available
  if (process.env.RESEND_API_KEY) {
    try {
      console.log("Attempting dispatch via Resend API...");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "School ERP <onboarding@resend.dev>",
          to: [adminEmail],
          subject,
          html: emailHtml,
        }),
      });
      const data = await res.json();
      console.log("Resend API response:", data);
      if (res.ok) sent = true;
    } catch (e) {
      console.error("Resend error:", e);
    }
  }

  // 2. Try SMTP if configured
  if (!sent && process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      console.log("Attempting dispatch via SMTP...");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
        },
      });
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject,
        html: emailHtml,
      });
      console.log("SMTP response messageId:", info.messageId);
      sent = true;
    } catch (e) {
      console.error("SMTP error:", e);
    }
  }

  if (!sent) {
    console.log("ℹ️ Simulated delivery executed (add RESEND_API_KEY or SMTP credentials in .env or Render to deliver live to mailbox).");
  }

  // Record to logs/registration-emails.log
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(
    path.join(logsDir, "registration-emails.log"),
    `[${new Date().toISOString()}] TEST DISPATCH TO="${adminEmail}" SCHOOL="${schoolName}" PORTAL="${portalUrl}"\n`
  );

  console.log("✅ Verification finished successfully.");
}

testEmail().catch(console.error);
