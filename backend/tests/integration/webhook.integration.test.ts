import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '../../src/app';
import { connectTestDb, disconnectTestDb, clearDatabase } from '../helpers/db-connect';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { PaymentAttempt } from '../../src/models/PaymentAttempt';
import { WebhookEvent } from '../../src/models/WebhookEvent';
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
      createRefund: vi.fn(async () => ({
        refundId: 'ref_x',
        refundAmount: 1000,
        refundStatus: 'SUCCEEDED',
        referenceId: 'ref_1',
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

let app: ReturnType<typeof createApp>;

async function seedOrder() {
  const product = await Product.create({
    name: 'Webhook Product',
    description: 'x',
    type: 'PRODUCT',
    priceMinor: 1000,
    currency: 'INR',
    isActive: true,
    stock: 5,
    sku: 'WH-1',
  });
  const { createCheckout } = await import('../../src/services/payment.service');
  const checkout = await createCheckout({
    orderId: `WH-ORD-${Date.now()}`,
    customer: { name: 'W', email: 'w@test.com' },
    items: [{ productId: product._id.toString(), quantity: 1 }],
  });
  const order = await Order.findOne({ orderNumber: checkout.orderId });
  return { order, checkout };
}

describe('webhook integration', () => {
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

  it('processes a success webhook and marks order paid', async () => {
    const { order } = await seedOrder();
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const payload = {
      eventId: 'evt_success_1',
      eventType: 'payment.success',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_1',
        payment_status: 'SUCCESS',
        order_status: 'ACTIVE',
      },
    };

    const res = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('PAID');
    expect(updated.status).toBe('CONFIRMED');

    const attemptUpdated = await PaymentAttempt.findById(attempt._id);
    expect(attemptUpdated.verificationStatus).toBe('VERIFIED');
  });

  it('deduplicates a repeated webhook event', async () => {
    const { order } = await seedOrder();
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const payload = {
      eventId: 'evt_dup_1',
      eventType: 'payment.success',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_1',
        payment_status: 'SUCCESS',
        order_status: 'ACTIVE',
      },
    };

    const bodyStr = JSON.stringify(payload);
    const r1 = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(bodyStr);
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(bodyStr);
    expect(r2.status).toBe(200);
    expect(r2.body.duplicate).toBe(true);

    const count = await WebhookEvent.countDocuments({ externalId: 'evt_dup_1' });
    expect(count).toBe(1);
  });

  it('does not downgrade a confirmed PAID order with a stale failure webhook', async () => {
    const { order } = await seedOrder();
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const successPayload = {
      eventId: 'evt_stale_success',
      eventType: 'payment.success',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_1',
        payment_status: 'SUCCESS',
        order_status: 'ACTIVE',
      },
    };
    await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(successPayload);

    let updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('PAID');

    const failurePayload = {
      eventId: 'evt_stale_fail',
      eventType: 'payment.failed',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_2',
        payment_status: 'FAILED',
        order_status: 'FAILED',
      },
    };
    await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(failurePayload);

    updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('PAID');
    expect(updated.status).toBe('CONFIRMED');
  });

  it('handles pending payment without marking failed', async () => {
    const { order } = await seedOrder();
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const payload = {
      eventId: 'evt_pending',
      eventType: 'payment.pending',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_1',
        payment_status: 'PENDING',
        order_status: 'ACTIVE',
      },
    };
    const res = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=valid')
      .send(payload);
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('PENDING');
    expect(updated.paymentStatus).not.toBe('FAILED');
  });
});
