require("dotenv").config();
const { sendMail } = require("./utils/mailer");

async function main() {
  const to = process.argv[2] || process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!to) {
    console.error("Missing recipient email. Pass as arg: node test-send-to.js you@example.com");
    process.exit(1);
  }

  const code1 = String(Math.floor(100000 + Math.random() * 900000));
  const code2 = String(Math.floor(100000 + Math.random() * 900000));

  await sendMail({
    to,
    subject: "Hand Aura - تأكيد الحساب",
    text: `رمز تأكيد الحساب: ${code1}`
  });
  console.log("MAIL_OK_1", to, code1);

  await new Promise((r) => setTimeout(r, 1500));

  await sendMail({
    to,
    subject: "Hand Aura - تأكيد الحساب",
    text: `رمز تأكيد الحساب: ${code2}`
  });
  console.log("MAIL_OK_2", to, code2);
}

main().catch((e) => {
  console.error("MAIL_FAIL", e && e.message);
  process.exit(1);
});

