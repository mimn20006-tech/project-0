const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { passport, hasGoogle, hasApple } = require("../oauth");
const { JWT_SECRET } = require("../middleware/auth");

function issueToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      country: user.country,
      address: user.address,
      avatar: user.avatar,
      loyaltyPoints: Number(user.loyaltyPoints || 0),
      loyaltySpent: Number(user.loyaltySpent || 0)
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function htmlRedirect(token, user) {
  const safeUser = JSON.stringify({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    country: user.country,
    address: user.address,
    avatar: user.avatar,
    loyaltyPoints: Number(user.loyaltyPoints || 0),
    loyaltySpent: Number(user.loyaltySpent || 0)
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
  <html><head><meta charset="utf-8"><title>Signed in</title></head>
  <body>
  <script>
  localStorage.setItem("auth_token", ${JSON.stringify(token)});
  localStorage.setItem("auth_user", ${JSON.stringify(safeUser)});
  location.href = "/index.html";
  </script>
  </body></html>`;
}

router.get("/google", (req, res, next) => {
  if (!hasGoogle) return res.status(400).send("Google OAuth not configured");
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get("/status", (req, res) => {
  res.json({ google: hasGoogle, apple: hasApple });
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!hasGoogle) return res.status(400).send("Google OAuth not configured");
    passport.authenticate("google", { session: false })(req, res, next);
  },
  async (req, res) => {
    const profile = req.user;
    const email = profile?.emails?.[0]?.value;
    const name = profile?.displayName || "User";
    const avatar = profile?.photos?.[0]?.value;
    if (!email) return res.status(400).send("Missing email");
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ name, email, avatar });
    const token = issueToken(user);
    res.send(htmlRedirect(token, user));
  }
);

router.get("/apple", (req, res, next) => {
  if (!hasApple) return res.status(400).send("Apple OAuth not configured");
  passport.authenticate("apple", { scope: ["name", "email"], session: false })(req, res, next);
});

router.post(
  "/apple/callback",
  (req, res, next) => {
    if (!hasApple) return res.status(400).send("Apple OAuth not configured");
    passport.authenticate("apple", { session: false })(req, res, next);
  },
  async (req, res) => {
    const profile = req.user;
    const email = profile?.email;
    const name = profile?.name
      ? `${profile.name.firstName || ""} ${profile.name.lastName || ""}`.trim()
      : "User";
    if (!email) return res.status(400).send("Missing email");
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ name, email });
    const token = issueToken(user);
    res.send(htmlRedirect(token, user));
  }
);

module.exports = router;
