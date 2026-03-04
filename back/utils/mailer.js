"use strict";

const sgMail = require("@sendgrid/mail");

const SENDGRID_API_KEY = (process.env.SENDGRID_API_KEY || "").trim();
const MAIL_FROM = (process.env.MAIL_FROM || "").trim();

function isSendGridConfigured() {
  return Boolean(SENDGRID_API_KEY && MAIL_FROM);
}

async function sendMail({ to, subject, text }) {
  if (!to || !subject) {
    throw new Error("sendMail requires to and subject");
  }

  if (!SENDGRID_API_KEY) {
    throw new Error("Email not configured: set SENDGRID_API_KEY in environment");
  }
  if (!MAIL_FROM) {
    throw new Error("Email not configured: set MAIL_FROM (verified sender) in environment");
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    await sgMail.send({
      to,
      from: MAIL_FROM,
      subject,
      text: text || "",
      html: text ? text.replace(/\n/g, "<br>") : ""
    });
    console.log("MAIL_SENT", { provider: "sendgrid", to });
  } catch (err) {
    const sgMessage = err?.response?.body?.errors?.[0]?.message || err.message || "Unknown SendGrid error";
    console.error("SENDGRID_ERROR", {
      message: sgMessage,
      code: err.code,
      response: err.response?.body,
      statusCode: err.response?.statusCode
    });
    throw new Error(`SendGrid rejected email request: ${sgMessage}`);
  }
}

module.exports = { sendMail, isSendGridConfigured };
