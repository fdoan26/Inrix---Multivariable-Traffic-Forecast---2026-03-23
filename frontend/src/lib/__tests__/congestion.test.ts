import { describe, it, expect } from 'vitest';
import { deriveCongestionLevel } from '@/lib/congestion';

describe('deriveCongestionLevel', () => {
  it('returns free_flow when ratio <= 1.2', () => {
    // ratio = 36/30 = 1.2
    expect(deriveCongestionLevel(36, 30)).toBe('free_flow');
  });

  it('returns moderate when ratio is between 1.2 and 1.5', () => {
    // ratio = 36/25 = 1.44
    expect(deriveCongestionLevel(36, 25)).toBe('moderate');
  });

  it('returns heavy when ratio > 1.5', () => {
    // ratio = 36/20 = 1.8
    expect(deriveCongestionLevel(36, 20)).toBe('heavy');
  });

  it('returns unknown when p10 is 0', () => {
    expect(deriveCongestionLevel(36, 0)).toBe('unknown');
  });

  it('returns unknown when p10 is negative', () => {
    expect(deriveCongestionLevel(36, -1)).toBe('unknown');
  });
});
