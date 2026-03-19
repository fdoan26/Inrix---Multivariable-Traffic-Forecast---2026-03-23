import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Mock axios before importing the module
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import { computeHashToken, InrixAuthService } from '../inrix-auth.js';
import axios from 'axios';

const mockedAxiosGet = vi.mocked(axios.get);

describe('INRIX Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeHashToken', () => {
    it('returns SHA1 hex of lowercase appId|appKey', () => {
      const expected = crypto
        .createHash('sha1')
        .update('testappid|testappkey', 'utf8')
        .digest('hex');
      const result = computeHashToken('testAppId', 'testAppKey');
      expect(result).toBe(expected);
    });

    it('handles already-lowercase input', () => {
      const expected = crypto
        .createHash('sha1')
        .update('myid|mykey', 'utf8')
        .digest('hex');
      expect(computeHashToken('myid', 'mykey')).toBe(expected);
    });
  });

  describe('InrixAuthService', () => {
    let service: InrixAuthService;

    beforeEach(() => {
      service = new InrixAuthService({ appId: 'testId', appKey: 'testKey' });
    });

    it('acquires a token on first call', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockedAxiosGet.mockResolvedValueOnce({
        data: { result: { token: 'abc123', expiry: futureExpiry } },
      });

      const token = await service.getToken();
      expect(token).toBe('abc123');
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
    });

    it('returns cached token on second call without HTTP request', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockedAxiosGet.mockResolvedValueOnce({
        data: { result: { token: 'abc123', expiry: futureExpiry } },
      });

      await service.getToken();
      const token2 = await service.getToken();
      expect(token2).toBe('abc123');
      expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
    });

    it('refreshes token when within 5 minutes of expiry', async () => {
      const nearExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min from now
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockedAxiosGet
        .mockResolvedValueOnce({
          data: { result: { token: 'token1', expiry: nearExpiry } },
        })
        .mockResolvedValueOnce({
          data: { result: { token: 'token2', expiry: futureExpiry } },
        });

      const t1 = await service.getToken();
      expect(t1).toBe('token1');

      const t2 = await service.getToken();
      expect(t2).toBe('token2');
      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    });

    it('makes new HTTP request after invalidate()', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockedAxiosGet
        .mockResolvedValueOnce({
          data: { result: { token: 'token1', expiry: futureExpiry } },
        })
        .mockResolvedValueOnce({
          data: { result: { token: 'token2', expiry: futureExpiry } },
        });

      await service.getToken();
      service.invalidate();
      const token = await service.getToken();
      expect(token).toBe('token2');
      expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
    });
  });
});
