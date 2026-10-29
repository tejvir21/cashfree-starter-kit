# Troubleshooting

## MongoDB connection fails

- Ensure MongoDB is running: `mongod` or use Atlas URI
- Check `MONGODB_URI` in `.env`
- Backend `/ready` endpoint reports DB readiness

## Backend won't start in production

Production requires `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. In sandbox mode these are optional (gateway calls fail safely).

## Webhook signature always invalid

- Set `CASHFREE_WEBHOOK_SECRET` in backend `.env`
- Ensure the route preserves the raw body (it does in `src/app.ts`)
- For local dev, use a public tunnel (ngrok), not `localhost`

## Frontend can't reach API

- Frontend proxies `/api` to `http://localhost:4000` in dev
- Ensure backend is running and CORS `ALLOWED_ORIGINS` includes the frontend URL
- Cookies are HttpOnly; CSRF token (`cf_csrf_token`) must be sent on state-changing requests

## Tests fail

- Tests use a real MongoDB (via `MONGODB_URI` or `mongodb-memory-server`)
- Cashfree adapter is mocked in tests — no real gateway calls
- Run `npm run test:backend` from the root

## Payments never show as PAID

- Payment success is verified server-side only (Cashfree `getOrder` / webhook)
- Frontend redirect/SDK callbacks alone are not trusted
- Use the admin "Reconcile" action to query Cashfree for uncertain payments
