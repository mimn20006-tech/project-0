const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const AppleStrategy = require("passport-apple");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

let hasGoogle = false;
let hasApple = false;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/api/oauth/google/callback`
      },
      (accessToken, refreshToken, profile, done) => done(null, profile)
    )
  );
  hasGoogle = true;
}

const appleKeyFile = process.env.APPLE_PRIVATE_KEY_FILE;
const appleKeyInline = process.env.APPLE_PRIVATE_KEY;
const applePrivateKey = appleKeyInline
  ? appleKeyInline.replace(/\\n/g, "\n")
  : appleKeyFile && fs.existsSync(appleKeyFile)
  ? fs.readFileSync(appleKeyFile, "utf8")
  : null;

if (
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  applePrivateKey
) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKey: applePrivateKey,
        callbackURL: `${BASE_URL}/api/oauth/apple/callback`,
        scope: ["name", "email"]
      },
      (accessToken, refreshToken, idToken, profile, done) => done(null, profile)
    )
  );
  hasApple = true;
}

module.exports = { passport, hasGoogle, hasApple, BASE_URL };
