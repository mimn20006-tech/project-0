const nodemailer = require("nodemailer");

const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass
  }
});

async function sendMail({ to, subject, text }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !smtpPass) {
    throw new Error("SMTP not configured");
  }
  try {
    return await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
  } catch (err) {
    console.error("MAIL_ERROR", err.message);
    throw err;
  }
}

module.exports = { sendMail };
