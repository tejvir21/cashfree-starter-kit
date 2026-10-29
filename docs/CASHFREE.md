# Cashfree Payments Integration

## Environment

Default mode: **sandbox**. Production requires explicit `CASHFREE_ENVIRONMENT=production` and real credentials.

Base URLs:
- Sandbox: `https://sandbox.cashfree.com/pg`
- Production: `https://api.cashfree.com/pg`

## Authentication

All gateway calls use backend-only headers:
- `x-client-id`: `CASHFREE_APP_ID`
- `x-client-secret`: `CASHFREE_SECRET_KEY`
- `x-api-version`: `CASHFREE_API_VERSION`

The secret key is **never** sent to the frontend.

## Adapter layer

`backend/src/services/cashfree/index.ts` is the single gateway access point. Controllers never contain raw Cashfree logic.

## Payment lifecycle

1. Validate product/quantity/price server-side
2. Create internal order (MongoDB) — source of truth
3. Create Cashfree order via adapter
4. Persist gateway order reference + `PaymentAttempt`
5. Return client-safe checkout info (payment link / session id)
6. Frontend opens Cashfree checkout (SDK or redirect)
7. Customer completes payment
8. Webhook notifies backend → signature verified → order/payment updated
9. Server-side `verify` endpoint can be called on demand
10. Admin `reconcile` queries Cashfree for uncertain payments

## Webhooks

Endpoint: `POST /api/v1/webhooks/cashfree`

- Raw body preserved for signature verification
- Signature: `x-webhook-signature` header (`t=<ts>,v1=<hmac>`)
- HMAC-SHA-256 over `${timestamp}.${rawBody}` using `CASHFREE_WEBHOOK_SECRET`
- Events deduplicated by `eventId`
- Idempotent transitions; PAID orders are never downgraded by stale failure events
- Failures recorded in `WebhookEvent` for controlled reprocessing

## Local webhook testing

Cashfree cannot reach `localhost`. Use a public tunnel:

```bash
# Example with ngrok
ngrok http 4000

# Set CASHFREE_WEBHOOK_URL in .env to https://<tunnel>.ngrok.io/api/v1/webhooks/cashfree
# Register that URL in your Cashfree dashboard webhook settings
```

## Status

Integration uses the documented Cashfree PG API surface. It has **not** been verified against live Cashfree sandbox credentials — real `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` are required for end-to-end payment verification.
