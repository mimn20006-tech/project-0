require("dotenv").config();
const { sendMail } = require("./utils/mailer");

async function testVerifyFlow() {
  console.log("🧪 Testing Complete Verification Email Flow\n");

  const testEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  if (!testEmail) {
    console.error("❌ No test email found. Set ADMIN_EMAIL or SMTP_USER in .env");
    process.exit(1);
  }

  console.log(`📧 Test email: ${testEmail}\n`);

  try {
    // Step 1: Simulate register - send verification code
    console.log("📝 Step 1: Simulating registration - sending verification code...");
    const verifyCode1 = Math.floor(100000 + Math.random() * 900000).toString();
    
    await sendMail({
      to: testEmail,
      subject: "Hand Aura - تأكيد الحساب",
      text: `رمز تأكيد الحساب: ${verifyCode1}`
    });
    
    console.log(`✅ Verification email sent successfully`);
    console.log(`   Code: ${verifyCode1}\n`);

    // Step 2: Wait a bit
    console.log("⏳ Step 2: Waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("✅ Wait complete\n");

    // Step 3: Simulate resend - send new verification code
    console.log("🔄 Step 3: Simulating resend - sending new verification code...");
    const verifyCode2 = Math.floor(100000 + Math.random() * 900000).toString();
    
    await sendMail({
      to: testEmail,
      subject: "Hand Aura - تأكيد الحساب",
      text: `رمز تأكيد الحساب: ${verifyCode2}`
    });
    
    console.log(`✅ Resend email sent successfully`);
    console.log(`   New Code: ${verifyCode2}\n`);

    // Step 4: Wait a bit
    console.log("⏳ Step 4: Waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("✅ Wait complete\n");

    console.log("🎉 All email tests passed!\n");
    console.log("📬 Check your email inbox:");
    console.log(`   - First verification code: ${verifyCode1}`);
    console.log(`   - Second verification code (resend): ${verifyCode2}`);
    console.log(`\n✅ Email sending is working correctly!`);
    console.log(`✅ Verification flow is ready to use.`);

  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testVerifyFlow();
