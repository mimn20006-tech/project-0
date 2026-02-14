# Staging Payments Runbook

## 1) Required env (staging)

Set these in staging `.env`:

```env
NODE_ENV=production
FRONTEND_URL=https://YOUR-STAGING-FRONTEND
BASE_URL=https://YOUR-STAGING-BACKEND
ALLOWED_ORIGINS=https://YOUR-STAGING-FRONTEND

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

PAYMOB_API_KEY=...
PAYMOB_HMAC_SECRET=...
PAYMOB_INTEGRATION_ID=...
PAYMOB_IFRAME_ID=...
```

## 2) Webhook endpoints

- Stripe: `POST /api/payments/webhook/stripe`
- Paymob: `POST /api/payments/webhook/paymob`

## 3) Test cases

1. Create order (online payment method).
2. Start checkout session.
3. Complete test payment on provider.
4. Return to `payment.html` and verify:
   - `GET /api/payments/status/:orderId` returns `isPaid=true`.
5. Call provider webhook same payload again (duplicate):
   - order remains `paid`
   - no side effects duplicated.
6. Invalid webhook signature/HMAC:
   - endpoint returns `401`
   - order stays unchanged.
7. Failure path:
   - cancel/failed payment should keep order as `awaiting_payment`.

## 4) Monitoring

Use report endpoint:

`GET /api/reports/payments-health?hours=24`

Check:
- `totals.avgProcessingMs` (webhook timing)
- `totals.duplicates` (duplicate webhook calls)
- `totals.webhookErrors` (failure path)
- `totals.paidNow` (successful updates)

Recent logs:
- `GET /api/reports/audit?limit=100`

## 5) DB validation

Order should move:

- before pay: `paymentStatus=awaiting_payment`
- after successful verified webhook: `paymentStatus=paid`, `paidAt` set
- duplicates: status unchanged, no re-processing.
