# API Reference

Base path: `/api/v1`

## Authentication

- `POST /auth/register` — Register a customer (public; admin role blocked)
- `POST /auth/login` — Login (sets HttpOnly cookies)
- `POST /auth/logout` — Logout (clears cookies)
- `POST /auth/refresh` — Rotate access token via HttpOnly refresh cookie
- `GET /auth/me` — Current user

## Catalog

- `GET /products` — List products (search, filter, paginate)
- `GET /products/:id` — Product detail
- `POST /admin/products` — Create product (ADMIN)
- `PATCH /admin/products/:id` — Update product (ADMIN)
- `POST /admin/products/:id/deactivate` — Deactivate (ADMIN)
- `POST /admin/products/:id/activate` — Activate (ADMIN)

## Orders

- `POST /orders` — Create order (auth or guest)
- `GET /orders` — List orders (owner/admin)
- `GET /orders/:orderId` — Order detail (owner/admin/guest token)
- `POST /orders/:orderId/cancel` — Cancel eligible order
- `GET /orders/:orderId/timeline` — Order timeline

## Payments

- `POST /payments/orders/:orderId/checkout` — Initiate checkout (returns gateway info)
- `POST /payments/orders/:orderId/verify` — Server-side verify payment
- `GET /payments/orders/:orderId/status` — Payment status + attempts
- `GET /payments` — List payment attempts (ADMIN)
- `GET /payments/:paymentId` — Payment attempt detail
- `POST /payments/orders/:orderId/reconcile` — Reconcile payment (ADMIN)

## Refunds

- `POST /payments/orders/:orderId/refunds` — Create refund (ADMIN)
- `GET /payments/orders/:orderId/refunds` — Refunds for order
- `GET /refunds/:refundId` — Refund detail
- `POST /admin/refunds/:refundId/reconcile` — Reconcile refund (ADMIN)

## Webhooks

- `POST /webhooks/cashfree` — Cashfree webhook (signature verified)

## Administration

- `GET /admin/dashboard` — Dashboard stats
- `GET /admin/orders` — All orders (ADMIN)
- `GET /admin/payments` — All transactions (ADMIN)
- `GET /admin/refunds` — All refunds (ADMIN)
- `POST /admin/orders/:orderId/reconcile` — Reconcile order payment (ADMIN)
- `POST /admin/orders/:orderId/fulfillment` — Update fulfillment (ADMIN)
- `POST /admin/orders/:orderId/notes` — Add internal note (ADMIN)
- `GET /admin/webhooks` — Webhook events (ADMIN)
- `GET /admin/audit-logs` — Audit log (ADMIN)
- `GET /admin/settings` — Settings (ADMIN)
- `PATCH /admin/settings` — Update settings (ADMIN)

## System

- `GET /health`
- `GET /ready`

## Response format

Success: `{ data: ... }`  
Error: `{ error: "...", message: "..." }` (validation errors include `details`)
