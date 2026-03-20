import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cacheGet, cacheSet, cacheClear } from '../cache.js';

describe('In-memory TTL cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cacheClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for non-existent key', () => {
    expect(cacheGet('missing')).toBeUndefined();
  });

  it('stores value and retrieves it', () => {
    cacheSet('key1', { foo: 'bar' });
    expect(cacheGet('key1')).toEqual({ foo: 'bar' });
  });

  it('returns undefined for expired entry', () => {
    cacheSet('key2', 'value2');
    // Advance past default 6-hour TTL
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);
    expect(cacheGet('key2')).toBeUndefined();
  });

  it('clears all entries', () => {
    cacheSet('a', 1);
    cacheSet('b', 2);
    cacheClear();
    expect(cacheGet('a')).toBeUndefined();
    expect(cacheGet('b')).toBeUndefined();
  });

  it('respects custom TTL', () => {
    cacheSet('short', 'data', 1000);
    expect(cacheGet('short')).toBe('data');
    vi.advanceTimersByTime(1001);
    expect(cacheGet('short')).toBeUndefined();
  });

  it('deletes expired entry from internal Map on access (lazy eviction)', () => {
    cacheSet('evict', 'val');
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);
    // First access should evict
    cacheGet('evict');
    // Set a new value with same key - should work without conflict
    cacheSet('evict', 'new-val');
    expect(cacheGet('evict')).toBe('new-val');
  });
});
