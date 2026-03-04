require("dotenv").config();
const { sendVerificationEmail } = require("./utils/sendgrid");

async function main() {
  const to = process.argv[2] || process.env.ADMIN_EMAIL;
  if (!to) {
    console.error("Missing recipient email. Pass as arg: node test-send-to.js you@example.com");
    process.exit(1);
  }

  const code1 = String(Math.floor(100000 + Math.random() * 900000));
  const code2 = String(Math.floor(100000 + Math.random() * 900000));

  await sendVerificationEmail(to, code1);
  console.log("MAIL_OK_1", to, code1);

  await new Promise((r) => setTimeout(r, 1500));

  await sendVerificationEmail(to, code2);
  console.log("MAIL_OK_2", to, code2);
}

main().catch((e) => {
  console.error("MAIL_FAIL", e && e.message);
  process.exit(1);
});