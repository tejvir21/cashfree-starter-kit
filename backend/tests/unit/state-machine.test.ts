import { describe, it, expect } from 'vitest';
import { canTransitionOrder, ORDER_STATUSES } from '../../src/models/constants';

describe('order state machine', () => {
  it('allows DRAFT -> PENDING_PAYMENT', () => {
    expect(canTransitionOrder('DRAFT', 'PENDING_PAYMENT')).toBe(true);
  });

  it('allows PENDING_PAYMENT -> CONFIRMED', () => {
    expect(canTransitionOrder('PENDING_PAYMENT', 'CONFIRMED')).toBe(true);
  });

  it('allows CONFIRMED -> PROCESSING -> FULFILLED', () => {
    expect(canTransitionOrder('CONFIRMED', 'PROCESSING')).toBe(true);
    expect(canTransitionOrder('PROCESSING', 'FULFILLED')).toBe(true);
  });

  it('does not allow FULFILLED -> DRAFT', () => {
    expect(canTransitionOrder('FULFILLED', 'DRAFT')).toBe(false);
  });

  it('does not allow CANCELLED -> anything', () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransitionOrder('CANCELLED', to)).toBe(false);
    }
  });

  it('allows CANCELLED from PENDING_PAYMENT', () => {
    expect(canTransitionOrder('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
  });
});
