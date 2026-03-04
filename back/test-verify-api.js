require("dotenv").config();

const API_BASE = process.env.BASE_URL || "http://localhost:5000";
const API = `${API_BASE}/api/auth`;

async function testVerifyFlow() {
  console.log("Testing Verification Flow");
  console.log("API Base:", API_BASE);

  const testEmail = process.env.TEST_EMAIL;
  if (!testEmail) {
    throw new Error("Missing TEST_EMAIL in .env");
  }

  const testName = "Test User";
  const testPassword = "testpass123";

  try {
    // 1️⃣ Register
    console.log("\nRegistering...");
    const registerRes = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword
      })
    });

    const registerData = await registerRes.json();

    console.log("Register status:", registerRes.status);
    console.log("Register response:", registerData);

    if (!registerRes.ok) {
      throw new Error("Register failed");
    }

    // 2️⃣ Wait
    await new Promise(r => setTimeout(r, 2000));

    // 3️⃣ Resend
    console.log("\nResending code...");
    const resendRes = await fetch(`${API}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail })
    });

    const resendData = await resendRes.json();

    console.log("Resend status:", resendRes.status);
    console.log("Resend response:", resendData);

    if (!resendRes.ok) {
      throw new Error("Resend failed");
    }

    console.log("\nDone. Check inbox:", testEmail);

  } catch (err) {
    console.error("Test failed:", err.message);

    if (err.message.includes("fetch") || err.message.includes("ECONNREFUSED")) {
      console.error("Server is probably not running.");
      console.error("Run: cd back && npm start");
    }

    process.exit(1);
  }
}

testVerifyFlow();