import { describe, it, expect } from 'vitest';
import {
  mapGatewayStatusToInternal,
  isGatewayPaymentSuccess,
  isGatewayPaymentFinalFailure,
  isGatewayPaymentPending,
} from '../../src/services/cashfree';

describe('gateway status mapping', () => {
  it('maps success statuses to PAID', () => {
    for (const s of ['SUCCESS', 'PAID', 'SUCCESSFUL']) {
      expect(mapGatewayStatusToInternal(s).status).toBe('PAID');
      expect(isGatewayPaymentSuccess(s)).toBe(true);
    }
  });

  it('maps failure statuses to FAILED', () => {
    for (const s of ['FAILED', 'CANCELLED', 'EXPIRED']) {
      expect(mapGatewayStatusToInternal(s).status).toBe('FAILED');
      expect(isGatewayPaymentFinalFailure(s)).toBe(true);
    }
  });

  it('maps pending statuses to PENDING', () => {
    for (const s of ['PENDING', 'PROCESSING', 'INITIATED']) {
      expect(mapGatewayStatusToInternal(s).status).toBe('PENDING');
      expect(isGatewayPaymentPending(s)).toBe(true);
    }
  });

  it('returns UNKNOWN for unrecognized status', () => {
    expect(mapGatewayStatusToInternal('UNKNOWN_STATUS').status).toBe('UNKNOWN');
  });
});
