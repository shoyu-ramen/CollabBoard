import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, rateLimitMap } from '@/app/api/ai/route';

describe('checkRateLimit', () => {
  beforeEach(() => {
    rateLimitMap.clear();
    vi.useRealTimers();
  });

  it('first call for a user returns true (allowed)', () => {
    expect(checkRateLimit('user-1')).toBe(true);
  });

  it('calls up to the limit (10) all return true', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('user-1')).toBe(true);
    }
  });

  it('11th call returns false (blocked)', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user-1');
    }
    expect(checkRateLimit('user-1')).toBe(false);
  });

  it('different user is tracked independently', () => {
    // Exhaust user-1's limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user-1');
    }
    expect(checkRateLimit('user-1')).toBe(false);

    // user-2 should still be allowed
    expect(checkRateLimit('user-2')).toBe(true);
  });

  it('after window expires (>60 seconds), counter resets', () => {
    vi.useFakeTimers();

    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user-1');
    }
    expect(checkRateLimit('user-1')).toBe(false);

    // Advance time by 61 seconds (past the 60s window)
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    expect(checkRateLimit('user-1')).toBe(true);
  });
});
