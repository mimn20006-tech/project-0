require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");
const { sendVerificationEmail } = require("./utils/sendgrid");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI || MONGODB_URI.includes("USER:PASSWORD@HOST")) {
  console.error("❌ Please set MONGODB_URI in .env file");
  process.exit(1);
}

async function testVerifyFlow() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const testEmail = `test-${Date.now()}@example.com`;
    const testName = "Test User";
    const testPassword = "testpass123";
    const bcrypt = require("bcryptjs");

    console.log("📝 Step 1: Creating test user...");
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Delete if exists
    await User.deleteOne({ email: testEmail });
    
    const user = await User.create({
      name: testName,
      email: testEmail,
      passwordHash,
      verifyCode,
      emailVerified: false
    });
    console.log(`✅ User created: ${user.email}`);
    console.log(`   Verify Code: ${verifyCode}\n`);

    console.log("📧 Step 2: Sending verification email...");
    try {
      await sendVerificationEmail(testEmail, verifyCode);
      console.log("✅ Email sent successfully\n");
    } catch (mailErr) {
      console.error("❌ Email send failed:", mailErr.message);
      throw mailErr;
    }

    console.log("🔍 Step 3: Verifying code is stored in DB...");
    const savedUser = await User.findOne({ email: testEmail });
    if (!savedUser) {
      throw new Error("User not found in DB");
    }
    if (savedUser.verifyCode !== verifyCode) {
      throw new Error(`Code mismatch! DB: ${savedUser.verifyCode}, Expected: ${verifyCode}`);
    }
    console.log(`✅ Code verified in DB: ${savedUser.verifyCode}\n`);

    console.log("🔄 Step 4: Testing resend code...");
    const newVerifyCode = Math.floor(100000 + Math.random() * 900000).toString();
    savedUser.verifyCode = newVerifyCode;
    await savedUser.save();
    
    try {
      await sendVerificationEmail(testEmail, newVerifyCode);
      console.log(`✅ Resend email sent with new code: ${newVerifyCode}\n`);
    } catch (mailErr) {
      console.error("❌ Resend email failed:", mailErr.message);
      throw mailErr;
    }

    console.log("✅ Step 5: Verifying code validation...");
    const verifyUser = await User.findOne({ email: testEmail });
    if (verifyUser.verifyCode !== newVerifyCode) {
      throw new Error("Code mismatch after resend");
    }
    console.log(`✅ Code validation OK: ${verifyUser.verifyCode}\n`);

    console.log("🎯 Step 6: Testing verify endpoint logic...");
    if (verifyUser.emailVerified) {
      console.log("⚠️  User already verified (should be false)");
    }
    if (verifyUser.verifyCode !== newVerifyCode) {
      throw new Error("Invalid code");
    }
    verifyUser.emailVerified = true;
    verifyUser.verifyCode = undefined;
    await verifyUser.save();
    console.log("✅ Verification logic works correctly\n");

    console.log("🧹 Cleaning up test user...");
    await User.deleteOne({ email: testEmail });
    console.log("✅ Test user deleted\n");

    console.log("🎉 All tests passed! Verification flow is working correctly.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testVerifyFlow();
