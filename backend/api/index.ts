// @ts-nocheck
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler } from "../src/middleware/error.js";
import { env } from "../src/config/env.js";
import paymentRoutes from "../src/routes/payments.js";
import { cashfreeWebhook } from "../src/controllers/webhook.controller.js";
import rateLimit from "express-rate-limit";
import { connectDb } from "../src/config/db.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/cashfree") {
    next();
  } else {
    express.json({ limit: "10kb" })(req, res, next);
  }
});
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/cashfree") {
    next();
  } else {
    express.urlencoded({ extended: true, limit: "10kb" })(req, res, next);
  }
});
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cashfree-payment-gateway" });
});
app.use(
  "/api/webhooks/cashfree",
  (req, res, next) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      req.rawBody = data;
      try {
        req.body = data ? JSON.parse(data) : {};
      } catch {
        req.body = {};
      }
      next();
    });
    req.on("error", next);
  },
  cashfreeWebhook,
);
app.use("/api/payments", paymentRoutes);
app.use((_req, res) => {
  res.status(404).json({ error: "Not found", message: "Route not found" });
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  errorHandler(err, _req, res, _next);
});

let isConnected = false;

export default async (req: any, res: any) => {
  try {
    if (!isConnected) {
      await connectDb();
      isConnected = true;
      console.log("MongoDB connected");
    }

    return app(req, res);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
};
