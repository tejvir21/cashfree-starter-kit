import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '../../src/app';
import { connectTestDb, disconnectTestDb, clearDatabase } from '../helpers/db-connect';
import { resetClientState, request, setAuthToken } from '../helpers/test-client';
import { Product } from '../../src/models/Product';
import { Order } from '../../src/models/Order';
import { PaymentAttempt } from '../../src/models/PaymentAttempt';
import { User } from '../../src/models/User';

// Mock the Cashfree adapter so tests are deterministic and never hit the network.
vi.mock('../../src/services/cashfree', async (importOriginal) => {
  const actual = await importOriginal();
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
      getOrder: vi.fn(async (orderId: string) => ({
        orderId,
        orderAmount: 1000,
        orderCurrency: 'INR',
        orderStatus: 'ACTIVE',
        paymentStatus: 'SUCCESS',
        payments: [
          {
            paymentId: `cfpay_${orderId}`,
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
  };
});

import { cashfreeAdapter } from '../../src/services/cashfree';
import { signAccessToken } from '../../src/utils/tokens';
import bcrypt from 'bcryptjs';

let app: ReturnType<typeof createApp>;
let server: any;
let baseUrl: string;

async function loginCustomer(email = 'buyer@test.com') {
  const hash = await bcrypt.hash('Str0ng!Pass123', 10);
  const user = await User.create({
    name: 'Buyer',
    email,
    passwordHash: hash,
    role: 'CUSTOMER',
  });
  const access = signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { token: access, userId: user._id.toString() };
}

async function seedProduct(priceMinor = 1000) {
  return Product.create({
    name: 'Test Product',
    description: 'A test product',
    type: 'PRODUCT',
    priceMinor,
    currency: 'INR',
    isActive: true,
    stock: 10,
    sku: `SKU-${Date.now()}`,
  });
}

describe('checkout and payment integration', () => {
  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
    server = app.listen(0);
    const addr = server.address() as any;
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearDatabase();
    resetClientState();
    vi.clearAllMocks();
  });

  it('guest checkout creates order + payment attempt and returns checkout info', async () => {
    const product = await seedProduct(1000);

    const res = await request(baseUrl, 'POST', '/api/v1/orders', {
      customerName: 'Guest User',
      customerEmail: 'guest@test.com',
      customerPhone: '9999999999',
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.totalPayableMinor).toBe(1000);
    expect(res.body.data.gatewayOrderId).toBeDefined();
    expect(res.body.data.paymentLink).toContain('cashfree.com');

    // Order persisted
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    expect(order).not.toBeNull();
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.paymentStatus).toBe('PENDING');

    // Payment attempt persisted
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });
    expect(attempt).not.toBeNull();
    expect(attempt.verificationStatus).toBe('UNVERIFIED');
    expect(attempt.cashfreeOrderId).toBeDefined();

    // Gateway called
    expect(cashfreeAdapter.createOrder).toHaveBeenCalled();
  });

  it('authenticated checkout attaches customer id', async () => {
    const product = await seedProduct(2000);
    const { token } = await loginCustomer();
    setAuthToken(token);

    const res = await request(
      baseUrl,
      'POST',
      '/api/v1/orders',
      {
        customerName: 'Buyer',
        customerEmail: 'buyer@test.com',
        items: [{ productId: product._id.toString(), quantity: 1 }],
      },
    );
    expect(res.status).toBe(201);
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    expect(order.customerId?.toString()).toBeDefined();
  });

  it('server-side verification marks order PAID (not trusting frontend)', async () => {
    const product = await seedProduct(1000);

    const res = await request(baseUrl, 'POST', '/api/v1/orders', {
      customerName: 'Verifier',
      customerEmail: 'v@test.com',
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    const orderId = res.body.data.orderId;

    const order = await Order.findOne({ orderNumber: orderId });
    const attempt = await PaymentAttempt.findOne({ orderId: order._id }).sort({
      createdAt: -1,
    });

    // Manually trigger verification via the service (simulate webhook result)
    const { verifyPayment } = await import('../../src/services/payment.service');
    const result = await verifyPayment({ paymentAttemptId: attempt._id.toString() });

    expect(result.verified).toBe(true);
    expect(result.paymentStatus).toBe('PAID');

    const updated = await Order.findOne({ orderNumber: orderId });
    expect(updated.paymentStatus).toBe('PAID');
    expect(updated.status).toBe('CONFIRMED');
  });

  it('prevents access to another customer order', async () => {
    const product = await seedProduct(1000);

    // create order as customer A
    const { token: tokenA } = await loginCustomer('a@test.com');
    setAuthToken(tokenA);
    await request(
      baseUrl,
      'POST',
      '/api/v1/orders',
      {
        customerName: 'CustomerA',
        customerEmail: 'a@test.com',
        items: [{ productId: product._id.toString(), quantity: 1 }],
      },
    );

    // create order as customer B
    const { token: tokenB } = await loginCustomer('b@test.com');
    resetClientState();
    setAuthToken(tokenB);

    // fetch list as B - should not see A's orders
    const res = await request(baseUrl, 'GET', '/api/v1/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('rejects inactive product', async () => {
    await Product.create({
      name: 'Inactive',
      description: 'x',
      type: 'PRODUCT',
      priceMinor: 100,
      currency: 'INR',
      isActive: false,
      sku: 'INACTIVE-1',
    });
    const product = await Product.findOne({ name: 'Inactive' });

    const res = await request(baseUrl, 'POST', '/api/v1/orders', {
      customerName: 'Verifier',
      customerEmail: 'v@test.com',
      items: [{ productId: product._id.toString(), quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });
});
