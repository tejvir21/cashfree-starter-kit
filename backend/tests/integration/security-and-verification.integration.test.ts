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
import { createHmac } from 'node:crypto';
import request from 'supertest';

let app: ReturnType<typeof createApp>;

async function createCustomer(email = 'buyer@test.com') {
  const hash = await bcrypt.hash('Str0ng!Pass123', 10);
  const user = await User.create({
    name: 'Buyer',
    email,
    passwordHash: hash,
    role: 'CUSTOMER',
  });
  const token = signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { token, userId: user._id.toString() };
}

async function createAdmin(email = 'admin@test.com') {
  const hash = await bcrypt.hash('Str0ng!Pass123', 10);
  const user = await User.create({
    name: 'Admin',
    email,
    passwordHash: hash,
    role: 'ADMIN',
  });
  const token = signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
  return { token, userId: user._id.toString() };
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

async function apiCreateOrder(token: string | undefined, productId: string, email = 'test@test.com', name = 'Test Customer') {
  const req = request(app)
    .post('/api/v1/orders')
    .send({
      customerName: name,
      customerEmail: email,
      items: [{ productId, quantity: 1 }],
    });
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req;
}

describe('payment verification, ownership, and webhook security', () => {
  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
    process.env.CASHFREE_WEBHOOK_SECRET = 'test_webhook_secret';
  });

  afterAll(async () => {
    await disconnectTestDb();
    delete process.env.CASHFREE_WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  // --- Invalid webhook signature tests ---
  it('rejects webhook with invalid signature', async () => {
    const product = await seedProduct();
    const res = await apiCreateOrder(undefined, product._id.toString(), 'w@test.com', 'Walter');
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const payload = {
      eventId: 'evt_invalid_sig',
      eventType: 'payment.success',
      data: { order_id: attempt.cashfreeOrderId, payment_status: 'SUCCESS' },
    };

    const res2 = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', 't=1,v1=invalidsignature')
      .send(payload);
    expect(res2.status).toBe(400);
  });

  it('rejects webhook with missing signature header', async () => {
    const product = await seedProduct();
    const res = await apiCreateOrder(undefined, product._id.toString(), 'w@test.com', 'Walter');
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const payload = {
      eventId: 'evt_no_sig',
      eventType: 'payment.success',
      data: { order_id: attempt.cashfreeOrderId, payment_status: 'SUCCESS' },
    };

    const res2 = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res2.status).toBe(400);
  });

  it('accepts webhook with valid signature', async () => {
    const product = await seedProduct();
    const res = await apiCreateOrder(undefined, product._id.toString(), 'w@test.com', 'Walter');
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      eventId: 'evt_valid_sig',
      eventType: 'payment.success',
      data: {
        order_id: attempt.cashfreeOrderId,
        payment_id: 'cfpay_1',
        payment_status: 'SUCCESS',
        order_status: 'ACTIVE',
      },
    };
    const bodyStr = JSON.stringify(payload);
    const sig = createHmac('sha256', 'test_webhook_secret').update(`${timestamp}.${bodyStr}`).digest('hex');
    const signatureHeader = `t=${timestamp},v1=${sig}`;

    const res2 = await request(app)
      .post('/api/v1/webhooks/cashfree')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signatureHeader)
      .send(bodyStr);
    expect(res2.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.paymentStatus).toBe('PAID');
  });

  // --- Order ownership tests ---
  it('prevents customer from accessing another customer order', async () => {
    const product = await seedProduct();

    const { token: tokenA } = await createCustomer('a@test.com');
    const resA = await apiCreateOrder(tokenA, product._id.toString(), 'a@test.com', 'CustomerA');
    expect(resA.status).toBe(201);
    const orderNumberA = resA.body.data.orderId;

    const { token: tokenB } = await createCustomer('b@test.com');
    const resB = await request(app)
      .get(`/api/v1/orders/${orderNumberA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(403);

    const resList = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resList.status).toBe(200);
    expect(resList.body.data.some((o: any) => o.orderNumber === orderNumberA)).toBe(false);
  });

  it('allows admin to access any customer order', async () => {
    const product = await seedProduct();

    const { token: tokenCust } = await createCustomer('cust@test.com');
    const resCust = await apiCreateOrder(tokenCust, product._id.toString(), 'cust@test.com', 'Cust');
    expect(resCust.status).toBe(201);
    const orderNumber = resCust.body.data.orderId;

    const { token: adminToken } = await createAdmin('admin@test.com');
    const resAdmin = await request(app)
      .get(`/api/v1/orders/${orderNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).toBe(200);
  });

  // --- Refund cumulative limit tests ---
  it('enforces cumulative refund limit across multiple refunds', async () => {
    const product = await seedProduct();

    const { token: tokenCust } = await createCustomer('r@test.com');
    const res = await apiCreateOrder(tokenCust, product._id.toString(), 'r@test.com', 'Rachel');
    expect(res.status).toBe(201);
    const order = await Order.findOne({ orderNumber: res.body.data.orderId });
    const attempt = await PaymentAttempt.findOne({ orderId: order._id });

    attempt.verificationStatus = 'VERIFIED';
    attempt.cashfreePaymentId = 'cfpay_1';
    attempt.gatewayStatus = 'SUCCESS';
    attempt.verifiedAt = new Date();
    await attempt.save();
    order.paymentStatus = 'PAID';
    order.status = 'CONFIRMED';
    await order.save();

    const { token: adminToken } = await createAdmin('admin@test.com');
    const res1 = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amountMinor: 1000, reason: 'Full refund' });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post(`/api/v1/payments/orders/${order.orderNumber}/refunds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amountMinor: 100, reason: 'Extra refund' });
    expect(res2.status).toBe(400);
  });
});
