import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app';
import { connectTestDb, disconnectTestDb, clearDatabase } from '../helpers/db-connect';
import { resetClientState, request, bootstrapSession, setAuthToken } from '../helpers/test-client';
import { User } from '../../src/models/User';
import bcrypt from 'bcryptjs';
import { signAccessToken } from '../../src/utils/tokens';

const CUST_EMAIL = 'cust@test.com';
const CUST_PASS = 'Str0ng!Pass123';

let app: ReturnType<typeof createApp>;
let server: any;
let baseUrl: string;

describe('auth integration', () => {
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
  });

  it('registers a customer and sets cookies', async () => {
    const res = await request(baseUrl, 'POST', '/api/v1/auth/register', {
      name: 'Test Customer',
      email: CUST_EMAIL,
      password: CUST_PASS,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(CUST_EMAIL);
    expect(res.body.data.role).toBe('CUSTOMER');
  });

  it('rejects duplicate registration', async () => {
    await User.create({
      name: 'Existing',
      email: CUST_EMAIL,
      passwordHash: await bcrypt.hash(CUST_PASS, 10),
      role: 'CUSTOMER',
    });
    const res = await request(baseUrl, 'POST', '/api/v1/auth/register', {
      name: 'Dup',
      email: CUST_EMAIL,
      password: CUST_PASS,
    });
    expect(res.status).toBe(409);
  });

  it('logs in and returns cookies', async () => {
    await User.create({
      name: 'Test Customer',
      email: CUST_EMAIL,
      passwordHash: await bcrypt.hash(CUST_PASS, 10),
      role: 'CUSTOMER',
    });

    const res = await request(baseUrl, 'POST', '/api/v1/auth/login', {
      email: CUST_EMAIL,
      password: CUST_PASS,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(CUST_EMAIL);
  });

  it('rejects wrong password', async () => {
    await User.create({
      name: 'Test Customer',
      email: CUST_EMAIL,
      passwordHash: await bcrypt.hash(CUST_PASS, 10),
      role: 'CUSTOMER',
    });
    const res = await request(baseUrl, 'POST', '/api/v1/auth/login', {
      email: CUST_EMAIL,
      password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('get /auth/me with token', async () => {
    const user = await User.create({
      name: 'Test Customer',
      email: CUST_EMAIL,
      passwordHash: await bcrypt.hash(CUST_PASS, 10),
      role: 'CUSTOMER',
    });
    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    setAuthToken(token);

    const res = await request(baseUrl, 'GET', '/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(CUST_EMAIL);
  });
});
