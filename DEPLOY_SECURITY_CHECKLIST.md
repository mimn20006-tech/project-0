# Hand Aura - Secure Deploy Checklist (Railway + Google Play)

This checklist ensures secrets are never exposed in frontend/mobile bundles and all sensitive operations stay on the backend.

## 1) Before deploy (local repo)

- Confirm secret files are ignored by git:
  - `mobile/android/keystore.properties`
  - `mobile/android/app/*.jks`
  - `mobile/android/app/*.keystore`
- Do not commit:
  - real `.env` files
  - API keys
  - OAuth client secrets
  - payment secrets

Quick checks:

```bash
git status
git check-ignore -v mobile/android/keystore.properties
git check-ignore -v mobile/android/app/handaura-release-key.jks
```

## 2) Railway backend environment variables

Set these in Railway service variables (never in frontend code):

- Core:
  - `NODE_ENV=production`
  - `PORT=5000`
  - `MONGODB_URI=...`
  - `JWT_SECRET=...` (required; backend fails if missing)
  - `ALLOWED_ORIGINS=https://your-front-domain`
- Email:
  - `SENDGRID_API_KEY=...`
  - `MAIL_FROM=verified-sender@yourdomain.com`
- OAuth:
  - `GOOGLE_CLIENT_ID=...`
  - `GOOGLE_CLIENT_SECRET=...`
- Payments (if enabled):
  - `STRIPE_SECRET_KEY=...`
  - `STRIPE_WEBHOOK_SECRET=...`
  - `PAYPAL_CLIENT_ID=...`
  - `PAYPAL_WEBHOOK_ID=...`
  - `PAYMOB_API_KEY=...`
  - `PAYMOB_HMAC_SECRET=...`
  - `PAYMOB_INTEGRATION_ID=...`
  - `PAYMOB_IFRAME_ID=...`
  - `FAWRY_MERCHANT_CODE=...`
  - `FAWRY_SECRET=...`
- Optional:
  - `UPLOAD_DIR=/data/uploads` (with persistent volume)
  - `FRONTEND_URL=https://your-front-domain`

## 3) Frontend safety rules

- Frontend can only use public backend base URL.
- Never place in frontend/mobile:
  - `SENDGRID_API_KEY`
  - `GOOGLE_CLIENT_SECRET`
  - any payment secret keys
  - database credentials

## 4) Android signing (local/CI)

### Option A: local file-based signing

Use `mobile/android/keystore.properties` (git-ignored):

```properties
storeFile=handaura-release-key.jks
storePassword=...
keyAlias=...
keyPassword=...
```

Place keystore at:

- `mobile/android/app/handaura-release-key.jks`

### Option B: CI environment signing (recommended)

Set these environment variables in CI:

- `ANDROID_SIGNING_STORE_FILE`
- `ANDROID_SIGNING_STORE_PASSWORD`
- `ANDROID_SIGNING_KEY_ALIAS`
- `ANDROID_SIGNING_KEY_PASSWORD`

`app/build.gradle` already supports both env-based and file-based signing.

## 5) Build signed AAB for Play Store

From `mobile/android`:

```bash
gradlew bundleRelease
```

Output:

- `mobile/android/app/build/outputs/bundle/release/app-release.aab`

## 6) Verify AAB signature

```bash
keytool -printcert -jarfile mobile/android/app/build/outputs/bundle/release/app-release.aab
```

Ensure owner/certificate matches your production keystore.

## 7) Deploy smoke tests (must pass)

- Register user
- Email verification (SendGrid)
- Login/logout
- Forgot/reset password
- Google OAuth login
- Product list + image loading
- Add to cart + checkout flow
- Admin login + protected actions

## 8) Incident safety

If any secret leaks:

1. Rotate key immediately at provider.
2. Update Railway variables.
3. Redeploy backend.
4. Invalidate related tokens/sessions if needed.

