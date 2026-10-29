import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { cashfreeAdapter } from '../../src/services/cashfree';

const SECRET = 'test_webhook_secret';

function computeSignature(body: string, timestamp: number): string {
  // Replicates the adapter's signing scheme: HMAC-SHA256(secret, `${timestamp}.${body}`)
  return createHmac('sha256', SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function makeSignatureHeader(timestamp: number, sig: string): string {
  return `t=${timestamp},v1=${sig}`;
}

describe('webhook signature validation', () => {
  beforeEach(() => {
    process.env.CASHFREE_WEBHOOK_SECRET = SECRET;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    delete process.env.CASHFREE_WEBHOOK_SECRET;
  });

  it('accepts a valid signature', async () => {
    const body = JSON.stringify({ eventType: 'payment.success', order_id: 'ord_1' });
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = computeSignature(body, timestamp);
    const header = makeSignatureHeader(timestamp, sig);

    const valid = await cashfreeAdapter.verifyWebhookSignature(body, header);
    expect(valid).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const body = JSON.stringify({ eventType: 'payment.success' });
    const timestamp = Math.floor(Date.now() / 1000);
    const header = makeSignatureHeader(timestamp, 'deadbeefinvalid');

    const valid = await cashfreeAdapter.verifyWebhookSignature(body, header);
    expect(valid).toBe(false);
  });

  it('rejects a tampered body', async () => {
    const body = JSON.stringify({ eventType: 'payment.success', order_id: 'ord_1' });
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = computeSignature(body, timestamp);
    const header = makeSignatureHeader(timestamp, sig);

    const tampered = JSON.stringify({ eventType: 'payment.success', order_id: 'ord_2' });
    const valid = await cashfreeAdapter.verifyWebhookSignature(tampered, header);
    expect(valid).toBe(false);
  });

  it('rejects an old timestamp (replay)', async () => {
    const body = JSON.stringify({ eventType: 'payment.success' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 1200; // 20 min ago
    const sig = computeSignature(body, oldTimestamp);
    const header = makeSignatureHeader(oldTimestamp, sig);

    const valid = await cashfreeAdapter.verifyWebhookSignature(body, header);
    expect(valid).toBe(false);
  });

  it('rejects a malformed signature header', async () => {
    const valid = await cashfreeAdapter.verifyWebhookSignature('{}', 'not-a-signature');
    expect(valid).toBe(false);
  });

  it('returns false when no webhook secret configured (production)', async () => {
    delete process.env.CASHFREE_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    const valid = await cashfreeAdapter.verifyWebhookSignature('{}', 't=1,v1=abc');
    expect(valid).toBe(false);
  });
});
