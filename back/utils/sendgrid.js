"use strict";

const { sendMail } = require("./mailer");

/**
 * Send verification email (uses SendGrid if SENDGRID_API_KEY is set, else SMTP via mailer).
 * @param {string} to - Recipient email
 * @param {string} code - Verification code
 */
async function sendVerificationEmail(to, code) {
  await sendMail({
    to,
    subject: "Hand Aura - رمز التفعيل",
    text: `رمز التفعيل الخاص بك: ${code}`,
    html: `<p>رمز التفعيل الخاص بك: <strong>${code}</strong></p>`
  });
  console.log("Email sent to", to);
}

module.exports = { sendVerificationEmail };
