import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { collectSpeeds } from '../inrix-speeds.js';
import type { InrixAuthService } from '../../services/inrix-auth.js';

vi.mock('axios');
vi.mock('../../services/budget-tracker.js', () => ({
  checkBudget: vi.fn(),
  recordCall: vi.fn(),
  updateCallStatus: vi.fn(),
}));
vi.mock('../../db/queries/speed-readings.js', () => ({
  insertSpeedReadings: vi.fn(),
}));
vi.mock('../../db/queries/budget.js', () => ({
  logJobStart: vi.fn(),
  logJobEnd: vi.fn(),
}));
vi.mock('../../services/retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { checkBudget, recordCall, updateCallStatus } from '../../services/budget-tracker.js';
import { insertSpeedReadings } from '../../db/queries/speed-readings.js';
import { logJobStart, logJobEnd } from '../../db/queries/budget.js';

const mockedAxiosGet = vi.mocked(axios.get);
const mockedCheckBudget = vi.mocked(checkBudget);
const mockedRecordCall = vi.mocked(recordCall);
const mockedUpdateCallStatus = vi.mocked(updateCallStatus);
const mockedInsertSpeedReadings = vi.mocked(insertSpeedReadings);
const mockedLogJobStart = vi.mocked(logJobStart);
const mockedLogJobEnd = vi.mocked(logJobEnd);

function createMockAuth(): InrixAuthService {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidate: vi.fn(),
  } as unknown as InrixAuthService;
}

const VALID_SPEED_RESPONSE = {
  result: {
    segmentSpeed: [
      {
        segments: [
          {
            code: 'SF101',
            segmentId: 'seg-001',
            speed: 45,
            reference: 65,
            average: 50,
            speedBucket: 1,
            travelTimeMinutes: 2.5,
          },
          {
            code: 'SF102',
            segmentId: 'seg-002',
            speed: 30,
            reference: 60,
            average: 45,
            speedBucket: 2,
            travelTimeMinutes: 3.8,
          },
        ],
      },
    ],
  },
};

describe('collectSpeeds', () => {
  let mockAuth: InrixAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = createMockAuth();
    mockedLogJobStart.mockResolvedValue(1);
    mockedRecordCall.mockResolvedValue(10);
    mockedInsertSpeedReadings.mockResolvedValue(2);
    mockedUpdateCallStatus.mockResolvedValue(undefined);
    mockedLogJobEnd.mockResolvedValue(undefined);
  });

  it('fetches from INRIX speed URL with correct box param when budget allowed', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxiosGet.mockResolvedValue({ data: VALID_SPEED_RESPONSE });

    await collectSpeeds(mockAuth);

    expect(mockedAxiosGet).toHaveBeenCalledWith(
      'https://segment-api.inrix.com/v1/segments/speed',
      expect.objectContaining({
        params: expect.objectContaining({
          box: '37.858|-122.541,37.699|-122.341',
          SpeedOutputFields: 'All',
          units: 0,
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
      })
    );
  });

  it('returns skipped result without HTTP call when budget NOT allowed', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: false, count: 1600 });

    const result = await collectSpeeds(mockAuth);

    expect(result).toEqual({ skipped: true, reason: 'budget_exhausted' });
    expect(mockedAxiosGet).not.toHaveBeenCalled();
  });

  it('validates response with SpeedResponseSchema and inserts correct segment count', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxiosGet.mockResolvedValue({ data: VALID_SPEED_RESPONSE });

    const result = await collectSpeeds(mockAuth);

    expect(result).toEqual({ segmentCount: 2 });
    expect(mockedInsertSpeedReadings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ segmentId: 'seg-001', speed: 45 }),
        expect.objectContaining({ segmentId: 'seg-002', speed: 30 }),
      ]),
      expect.any(Date)
    );
  });

  it('calls recordCall BEFORE axios.get', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });

    const callOrder: string[] = [];
    mockedRecordCall.mockImplementation(async () => {
      callOrder.push('recordCall');
      return 10;
    });
    mockedAxiosGet.mockImplementation(async () => {
      callOrder.push('axios.get');
      return { data: VALID_SPEED_RESPONSE };
    });

    await collectSpeeds(mockAuth);

    expect(callOrder.indexOf('recordCall')).toBeLessThan(callOrder.indexOf('axios.get'));
  });

  it('invalidates auth token on 401 response', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });

    const axiosError = new (await import('axios')).AxiosError('Unauthorized');
    axiosError.response = { status: 401, data: {}, headers: {}, statusText: 'Unauthorized', config: {} as any };

    // withRetry is mocked to just call fn() directly, so the error propagates
    const { withRetry: mockedWithRetry } = await import('../../services/retry.js');
    vi.mocked(mockedWithRetry).mockImplementationOnce(async (fn) => {
      return fn();
    });

    mockedAxiosGet.mockRejectedValue(axiosError);

    await expect(collectSpeeds(mockAuth)).rejects.toThrow();
    expect(mockAuth.invalidate).toHaveBeenCalled();
  });

  it('logs job start and end on success', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxiosGet.mockResolvedValue({ data: VALID_SPEED_RESPONSE });

    await collectSpeeds(mockAuth);

    expect(mockedLogJobStart).toHaveBeenCalledWith('inrix_speeds');
    expect(mockedLogJobEnd).toHaveBeenCalledWith(1, 'success', 2);
  });

  it('updates call status to success with response time', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxiosGet.mockResolvedValue({ data: VALID_SPEED_RESPONSE });

    await collectSpeeds(mockAuth);

    expect(mockedUpdateCallStatus).toHaveBeenCalledWith(
      10,
      'success',
      200,
      expect.any(Number)
    );
  });
});
