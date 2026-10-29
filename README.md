# Minimal Cashfree Payment Gateway

A simple, reusable Cashfree Payment Gateway integration for accepting payments. Users can enter their details and amount, click Pay Now, and complete payment using Cashfree Checkout.

## Features

- Clean, responsive payment page
- Full name, email, Indian mobile number, amount, and optional description
- Server-side validation
- Cashfree sandbox integration
- Payment verification after checkout
- Success, failure, and pending states
- Webhook support with signature verification

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + TypeScript

## Project structure

```
cashfree-payment-gateway/
  frontend/          # React + Vite + TypeScript SPA
  backend/           # Express + TypeScript API
  package.json       # npm workspaces root
  .env.example       # Environment template
```

## Prerequisites

- Node.js >= 20
- npm
- Cashfree sandbox credentials (App ID and Secret Key)

## Quick start (Windows PowerShell)

```powershell
# 1. Install all dependencies
npm install

# 2. Copy environment file and configure
Copy-Item .env.example .env
# Edit .env with your Cashfree sandbox credentials

# 3. Start frontend and backend together
npm run dev
```

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

## Required environment variables

See `.env.example` for all required variables:

- `PORT` - Backend port (default: 4000)
- `CLIENT_URL` - Frontend URL (default: http://localhost:5173)
- `ALLOWED_ORIGINS` - CORS allowed origins
- `CASHFREE_APP_ID` - Cashfree App ID
- `CASHFREE_SECRET_KEY` - Cashfree Secret Key
- `CASHFREE_ENVIRONMENT` - `sandbox` or `production` (default: sandbox)
- `CASHFREE_API_VERSION` - API version (default: 2025-08-01)
- `CASHFREE_WEBHOOK_SECRET` - Webhook secret for signature verification
- `MIN_PAYMENT_AMOUNT` - Minimum payment amount in INR (default: 1)
- `MAX_PAYMENT_AMOUNT` - Maximum payment amount in INR (default: 100000)

## How to run

### Development
```powershell
npm run dev
```

### Build
```powershell
npm run build
```

### Typecheck
```powershell
npm run typecheck
```

### Lint
```powershell
npm run lint
```

## How to complete a sandbox payment test

1. Start the app with `npm run dev`
2. Open `http://localhost:5173` in your browser
3. Fill in all required fields (name, email, Indian mobile number, amount)
4. Click "Pay Now"
5. You'll be redirected to Cashfree Checkout (sandbox mode)
6. Use Cashfree sandbox test cards to complete payment
7. After checkout, the page will verify and show payment status

## API Endpoints

### POST `/api/payments/create-order`
Create a payment order. Accepts customer details and amount.

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "amount": 100,
  "description": "Optional description"
}
```

**Response:**
```json
{
  "orderId": "ORD_...",
  "paymentSessionId": "..."
}
```

### GET `/api/payments/verify/:orderId`
Verify payment status from Cashfree server-side.

**Response:**
```json
{
  "status": "PAID" | "PENDING" | "FAILED"
}
```

### POST `/api/webhooks/cashfree`
Webhook endpoint for Cashfree notifications (requires signature verification).

## Security

- Cashfree secrets are only used on the backend, never exposed to frontend
- Server-side validation for all inputs
- Payment verification happens server-side, never trusting frontend callbacks
- Webhook signature verification using Cashfree's documented method
- Rate limiting and request size limits enabled
- CORS configured for intended origins
