import nodemailer from "nodemailer";

function createTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const transporter = createTransporter();
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@a1solar.com";

  const mailOptions = {
    from: `"A1 Solar Support" <${fromEmail}>`,
    to: toEmail,
    subject: "Password Reset Request - A1 Solar Solution",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 15px;">Hello,</p>
        <p style="color: #334155; font-size: 15px;">We received a request to reset your password for your A1 Solar account.</p>
        <div style="margin: 25px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
        <p style="color: #2563eb; font-size: 13px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #64748b; font-size: 13px; margin-top: 30px;">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} A1 Solar Solution. All rights reserved.</p>
      </div>
    `,
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] Password reset email sent to ${toEmail} (Message ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId, resetUrl };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send email via SMTP to ${toEmail}:`, err.message);
      console.log(`[EMAIL FALLBACK LINK] Reset link for ${toEmail}: ${resetUrl}`);
      return { sent: false, error: err.message, resetUrl };
    }
  } else {
    console.log(`[EMAIL CONFIG] SMTP credentials not set in .env. Reset link for ${toEmail}: ${resetUrl}`);
    return { sent: false, reason: "SMTP not configured", resetUrl };
  }
}
