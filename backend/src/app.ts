// @ts-nocheck
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler } from "./middleware/error";
import { env } from "./config/env";
import paymentRoutes from "./routes/payments";
import { cashfreeWebhook } from "./controllers/webhook.controller";
import rateLimit from "express-rate-limit";
import { connectDb } from "./config/db";
export function createApp() {
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
        (req as typeof req & { rawBody: string }).rawBody = data;
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

  connectDb();

  app.use("/api/payments", paymentRoutes);
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found", message: "Route not found" });
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      err: unknown,
      _req: import("express").Request,
      res: import("express").Response,
      _next: import("express").NextFunction,
    ) => {
      errorHandler(err, _req, res, _next);
    },
  );
  return app;
}

