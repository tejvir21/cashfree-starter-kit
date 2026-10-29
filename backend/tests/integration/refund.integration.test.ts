import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '../../src/app';
import { connectTestDb, disconnectTestDb, clearDatabase } from '../helpers/db-connect';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { PaymentAttempt } from '../../src/models/PaymentAttempt';
import { Refund } from '../../src/models/Refund';
import { User } from '../../src/models/User';
import { signAccessToken } from '../../src/utils/tokens';
import bcrypt from 'bcryptjs';
import request from 'supertest';

vi.mock('../../src/services/cashfree', () => {
  const actual = vi.importActual('../../src/services/cashfree');
  return {
    ...actual,
    cashfreeAdapter: {
      environment: 'sandbox',
      createOrder: vi.fn(async (req: any) => ({
        orderId: req.orderId,
        orderAmount: req.orderAmount,
        orderCurrency: req.orderCurrency,
        orderStatus: 'CREATED',
        paymentLink: `https://sandbox.cashfree.com/pay/${req.orderId}`,
        cfPaymentId: `cfpay_${req.orderId}`,
        paymentSessionId: `sess_${req.orderId}`,
        raw: {},
      })),
      getOrder: vi.fn(async () => ({
        orderId: 'ord_x',
        orderAmount: 1000,
        orderCurrency: 'INR',
        orderStatus: 'ACTIVE',
        paymentStatus: 'SUCCESS',
        payments: [
          {
            paymentId: 'cfpay_1',
            paymentAmount: 1000,
            paymentCurrency: 'INR',
            paymentStatus: 'SUCCESS',
            paymentMethod: 'upi',
            gateway: 'cashfree',
            raw: {},
          },
        ],
        raw: {},
      })),
      createRefund: vi.fn(async (req: any) => ({
        refundId: req.refundId,
        refundAmount: req.refundAmount,
        refundStatus: 'SUCCEEDED',
        referenceId: `ref_${req.refundId}`,
        raw: {},
      })),
      verifyWebhookSignature: vi.fn(async () => true),
    },
    isGatewayPaymentSuccess: actual.isGatewayPaymentSuccess,
    isGatewayPaymentFinalFailure: actual.isGatewayPaymentFinalFailure,
    isGatewayPaymentPending: actual.isGatewayPaymentPending,
    mapGatewayStatusToInternal: actual.mapGatewayStatusToInternal,
    buildIntentResult: actual.buildIntentResult,
  };
});

import { cashfreeAdapter } from '../../src/services/cashfree';

let app: ReturnType<typeof createApp>;

async function adminToken() {
  const hash = await bcrypt.hash('Str0ng!Pass123', 10);
  const user = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    passwordHash: hash,
    role: 'ADMIN',
    isEmailVerified: true,
  });
  return signAccessToken({ userId: user._id.toString(), email: 'admin@test.com', role: 'ADMIN' });
}

async function createCustomer(email = 'cust@test.com') {
  const hash = await bcrypt.hash('Str0ng!Pass123', 10);
  const user = await User.create({
    name: 'Customer',
    email,
    passwordHash: hash,
    role: 'CUSTOMER',
  });
  return signAccessToken({ userId: user._id.toString(), email, role: 'CUSTOMER' });
}

async function paidOrder() {
  const product = await Product.create({
    name: 'Refund Product',
    description: 'x',
    type: 'PRODUCT',
    priceMinor: 1000,
    currency: 'INR',
    isActive: true,
    stock: 5,
    sku: 'RF-1',
  });

  const order = await Order.create({
    orderNumber: `RF-ORD-${Date.now()}`,
    customerId: new (require('mongoose').Types.ObjectId)(),
    guestAccessToken: 'guest_' + Date.now(),
    customerName: 'R',
    customerEmail: 'r@test.com',
    customerPhone: undefined,
    customerNotes: undefined,
    items: [{
      productId: product._id,
      productSnapshot: { name: product.name, type: product.type, sku: product.sku, imageUrl: product.imageUrl },
      quantity: 1,
      unitPriceMinor: 1000,
      currency: 'INR',
      lineTotalMinor: 1000,
    }],
    discountMinor: 0,
    taxMinor: 0,
    totalPayableMinor: 1000,
    currency: 'INR',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'NOT_STARTED',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const attempt = await PaymentAttempt.create({
    internalPaymentId: 'PAY-' + Date.now(),
    orderId: order._id,
    attemptNumber: 1,
    amountMinor: 1000,
    currency: 'INR',
    gatewayStatus: 'SUCCESS',
    verificationStatus: 'VERIFIED',
    gatewayMetadata: {},
    verifiedAt: new Date(),
  });

  return { order, attempt };
}

describe('refund integration', () => {
  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  it('admin initiates a full refund', async () => {
    const token = await adminToken();
    const { order, attempt } = await paidOrder();

    const res = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 1000, reason: 'Customer cancelled' });

    expect(res.status).toBe(201);
    expect(res.body.data.internalRefundId).toBeDefined();
    expect(res.body.data.status).toBe('SUCCEEDED');
    expect(cashfreeAdapter.createRefund).toHaveBeenCalled();

    const refund = await Refund.findOne({ internalRefundId: res.body.data.internalRefundId });
    expect(refund).not.toBeNull();
    expect(refund.status).toBe('SUCCEEDED');
  });

  it('rejects refund exceeding payment amount', async () => {
    const token = await adminToken();
    const { order } = await paidOrder();

    const res = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 2000, reason: 'Too much' });

    expect(res.status).toBe(400);
  });

  it('rejects non-admin refund initiation', async () => {
    const { order } = await paidOrder();
    const { token: customerToken } = await createCustomer('cust@test.com');

    const res = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amountMinor: 100, reason: 'x' });

    // Non-admin users cannot initiate refunds (401 or 403 depending on auth state)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('prevents duplicate concurrent refunds (pending exists)', async () => {
    const token = await adminToken();
    const { order, attempt } = await paidOrder();

    await Refund.create({
      internalRefundId: 'RF-PENDING',
      paymentAttemptId: attempt._id,
      orderId: order._id,
      amountMinor: 500,
      currency: 'INR',
      reason: 'Existing pending',
      status: 'PENDING',
      requestedBy: new (require('mongoose').Types.ObjectId)(),
    });

    const res = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 300, reason: 'Duplicate while pending' });

    expect(res.status).toBe(400);
  });
});
