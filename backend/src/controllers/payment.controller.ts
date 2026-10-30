// @ts-nocheck
import { cashfreeAdapter } from "../services/cashfree";
import { env, MIN_PAYMENT_AMOUNT, MAX_PAYMENT_AMOUNT } from "../config/env";
import { randomUUID } from "crypto";
function validateCreateOrder(body) {
  const { name, email, phone, amount } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, error: "Full name is required" };
  }
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email address" };
  }
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Mobile number is required" };
  }
  // Basic Indian mobile validation
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, "").slice(-10))) {
    return { valid: false, error: "Invalid Indian mobile number" };
  }
  if (amount === undefined || amount === null) {
    return { valid: false, error: "Amount is required" };
  }
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount)) {
    return { valid: false, error: "Amount must be a valid number" };
  }
  if (numAmount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }
  // Check decimal places
  const amountStr = String(amount);
  if (amountStr.includes(".")) {
    const decimals = amountStr.split(".")[1];
    if (decimals && decimals.length > 2) {
      return {
        valid: false,
        error: "Amount can have at most 2 decimal places",
      };
    }
  }
  if (numAmount < MIN_PAYMENT_AMOUNT || numAmount > MAX_PAYMENT_AMOUNT) {
    return {
      valid: false,
      error: `Amount must be between ${MIN_PAYMENT_AMOUNT} and ${MAX_PAYMENT_AMOUNT} INR`,
    };
  }
  return { valid: true };
}
// In-memory store for orders (since no DB requirement)
const ordersStore = new Map();
export async function createOrder(req, res) {
  try {
    const validation = validateCreateOrder(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: "Bad request", message: validation.error });
      return;
    }
    const { name, email, phone, amount, description } = req.body;
    const numAmount = Number(amount);
    const orderId = `ORD_${randomUUID().replace(/-/g, "").substring(0, 16).toUpperCase()}`;
    try {
      const gatewayResp = await cashfreeAdapter.createOrder({
        orderId,
        orderAmount: Math.round(numAmount * 100) / 100, // Ensure proper decimal
        orderCurrency: "INR",
        customerDetails: {
          customerId: orderId,
          customerName: name.trim(),
          customerEmail: email.trim().toLowerCase(),
          customerPhone: phone.replace(/\D/g, "").slice(-10),
        },
        orderMeta: {
          returnUrl: `${env.CLIENT_URL}/?orderId=${orderId}`,
          notifyUrl: `${env.CLIENT_URL.replace(/:\d+$/, `:${env.PORT}`)}/api/webhooks/cashfree`,
        },
        orderTags: {
          description: description || "",
        },
      });
      ordersStore.set(orderId, {
        orderId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, "").slice(-10),
        amount: numAmount,
        description,
        status: "PENDING",
        gatewayOrderId: gatewayResp.orderId,
        paymentSessionId: gatewayResp.paymentSessionId,
        createdAt: new Date().toISOString(),
      });
      res.json({
        orderId,
        paymentSessionId: gatewayResp.paymentSessionId,
      });
    } catch (err) {
      console.error("Cashfree order creation error:", err);
      res
        .status(500)
        .json({
          error: "Payment error",
          message: "Failed to create payment order",
        });
    }
  } catch (err) {
    console.error("Create order error:", err);
    res
      .status(500)
      .json({ error: "Server error", message: "Internal server error" });
  }
}
export async function verifyOrder(req, res) {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      res
        .status(400)
        .json({ error: "Bad request", message: "Order ID is required" });
      return;
    }
    const order = ordersStore.get(orderId);
    if (!order) {
      res.status(404).json({ error: "Not found", message: "Order not found" });
      return;
    }
    try {
      const gatewayResp = await cashfreeAdapter.getOrder(
        order.gatewayOrderId || orderId,
      );
      const { buildIntentResult } = await import("../services/cashfree");
      const result = buildIntentResult(
        gatewayResp,
        Math.round(order.amount * 100),
        "INR",
      );
      let status = "PENDING";
      if (result.paymentStatus === "PAID") {
        status = "PAID";
        order.status = "PAID";
        ordersStore.set(orderId, order);
      } else if (result.paymentStatus === "FAILED") {
        status = "FAILED";
        order.status = "FAILED";
        ordersStore.set(orderId, order);
      }
      res.json({ status });
    } catch (err) {
      console.error("Verify order error:", err);
      res
        .status(500)
        .json({ error: "Payment error", message: "Failed to verify payment" });
    }
  } catch (err) {
    console.error("Verify order error:", err);
    res
      .status(500)
      .json({ error: "Server error", message: "Internal server error" });
  }
}
export { ordersStore };

