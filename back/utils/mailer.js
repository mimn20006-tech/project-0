const nodemailer = require("nodemailer");

const smtpPass = String(process.env.SMTP_PASS || "").trim();
const provider = String(process.env.MAIL_PROVIDER || "custom").trim().toLowerCase();

const providerDefaults = {
  brevo: { host: "smtp-relay.brevo.com", port: 587 },
  sendgrid: { host: "smtp.sendgrid.net", port: 587 },
  mailgun: { host: "smtp.mailgun.org", port: 587 },
  resend: { host: "smtp.resend.com", port: 587 }
};

const smtpHost = process.env.SMTP_HOST || providerDefaults[provider]?.host || "";
const smtpPort = Number(process.env.SMTP_PORT || providerDefaults[provider]?.port || 587);
const smtpSecure = smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 60000),
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass
  }
});

async function sendMail({ to, subject, text }) {
  const missing = [];
  if (!smtpHost) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!smtpPass) missing.push("SMTP_PASS");
  if (missing.length) {
    throw new Error(`SMTP not configured: missing ${missing.join(", ")}`);
  }
  try {
    return await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
  } catch (err) {
    console.error("MAIL_ERROR", {
      message: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode
    });
    throw err;
  }
}

module.exports = { sendMail };
