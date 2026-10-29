# Deployment

## MongoDB

Use a local MongoDB (`mongodb://127.0.0.1:27017/cashfree-commerce`) or MongoDB Atlas. Set `MONGODB_URI` accordingly.

## Backend

```bash
cd backend
npm install
npm run build
npm start
```

The backend listens on `PORT` (default 4000).

## Frontend

```bash
cd frontend
npm install
npm run build
# Serve `dist/` with any static host, or run `npm run dev` for development
```

The frontend proxies `/api` to `http://localhost:4000` in dev. In production, set `VITE_API_URL` to your backend URL.

## Environment variables

See `.env.example`. Required minimum for a functioning dev setup:

```
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/cashfree-commerce
CLIENT_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
JWT_ACCESS_SECRET=<random>
JWT_REFRESH_SECRET=<random>
CASHFREE_ENVIRONMENT=sandbox
CASHFREE_APP_ID=<sandbox app id>
CASHFREE_SECRET_KEY=<sandbox secret>
CASHFREE_WEBHOOK_SECRET=<webhook secret>
```

Never commit real secrets.

## Production

Set `NODE_ENV=production`, `CASHFREE_ENVIRONMENT=production`, and provide real Cashfree production credentials. Production startup will refuse to run without `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`.
