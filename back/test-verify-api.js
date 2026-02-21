require("dotenv").config();
const fetch = require("node-fetch");

const API_BASE = process.env.BASE_URL || "http://localhost:5000";
const API = `${API_BASE}/api/auth`;

async function testVerifyFlow() {
  console.log("🧪 Testing Complete Verification Flow\n");
  console.log(`📍 API Base: ${API_BASE}\n`);

  const testEmail = `test-${Date.now()}@example.com`;
  const testName = "Test User";
  const testPassword = "testpass123";

  try {
    // Step 1: Register
    console.log("📝 Step 1: Registering new user...");
    console.log(`   Email: ${testEmail}`);
    const registerRes = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword
      }),
      timeout: 30000
    });

    if (!registerRes.ok) {
      const error = await registerRes.text();
      throw new Error(`Register failed: ${error}`);
    }

    const registerData = await registerRes.json();
    console.log("✅ User registered successfully");
    console.log(`   Token: ${registerData.token ? "Received" : "Missing"}`);
    console.log(`   User ID: ${registerData.user?.id || "N/A"}\n`);

    // Step 2: Wait a bit for email to be sent
    console.log("⏳ Step 2: Waiting for email to be sent...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("✅ Email should have been sent\n");

    // Step 3: Test resend
    console.log("🔄 Step 3: Testing resend verification code...");
    const resendRes = await fetch(`${API}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
      timeout: 30000
    });

    if (!resendRes.ok) {
      const error = await resendRes.text();
      throw new Error(`Resend failed: ${error}`);
    }

    const resendData = await resendRes.json();
    console.log("✅ Resend request successful");
    console.log(`   Response: ${JSON.stringify(resendData)}\n`);

    // Step 4: Wait for resend email
    console.log("⏳ Step 4: Waiting for resend email to be sent...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("✅ Resend email should have been sent\n");

    console.log("🎉 All API tests passed!");
    console.log("\n📧 Check your email inbox for:");
    console.log(`   - Initial verification code`);
    console.log(`   - Resend verification code`);
    console.log(`\n💡 Note: You'll need to check the actual email to get the code.`);
    console.log(`   The code is sent to: ${testEmail}`);
    console.log(`   (This is a test email, so check your SMTP account's sent folder)`);

  } catch (err) {
    console.error("\n❌ Test failed:", err.message);
    if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch")) {
      console.error("\n💡 Make sure the server is running:");
      console.error("   cd back && npm start");
    }
    process.exit(1);
  }
}

testVerifyFlow();
