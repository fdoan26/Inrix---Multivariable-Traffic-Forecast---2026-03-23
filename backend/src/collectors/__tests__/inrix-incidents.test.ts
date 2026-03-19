import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { collectIncidents } from '../inrix-incidents.js';
import type { InrixAuthService } from '../../services/inrix-auth.js';

vi.mock('axios');
vi.mock('../../services/budget-tracker.js', () => ({
  checkBudget: vi.fn(),
  recordCall: vi.fn(),
  updateCallStatus: vi.fn(),
}));
vi.mock('../../db/queries/incidents.js', () => ({
  insertIncidents: vi.fn(),
}));
vi.mock('../../db/queries/budget.js', () => ({
  logJobStart: vi.fn(),
  logJobEnd: vi.fn(),
}));
vi.mock('../../services/retry.js', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { checkBudget, recordCall, updateCallStatus } from '../../services/budget-tracker.js';
import { insertIncidents } from '../../db/queries/incidents.js';
import { logJobStart, logJobEnd } from '../../db/queries/budget.js';

const mockedAxios = vi.mocked(axios);
const mockedCheckBudget = vi.mocked(checkBudget);
const mockedRecordCall = vi.mocked(recordCall);
const mockedUpdateCallStatus = vi.mocked(updateCallStatus);
const mockedInsertIncidents = vi.mocked(insertIncidents);
const mockedLogJobStart = vi.mocked(logJobStart);
const mockedLogJobEnd = vi.mocked(logJobEnd);

function createMockAuth(): InrixAuthService {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidate: vi.fn(),
  } as unknown as InrixAuthService;
}

const VALID_INCIDENT_RESPONSE = {
  result: {
    incidents: [
      {
        id: 'inc-001',
        type: 4,
        severity: 3,
        latitude: 37.78,
        longitude: -122.42,
        shortDesc: 'Multi-vehicle accident on US-101',
        longDesc: 'Lane closure expected for 2 hours',
        direction: 'Northbound',
        impacting: true,
        delayFromTypical: 12.5,
        delayFromFreeFlow: 18.0,
        status: 'Active',
      },
      {
        id: 'inc-002',
        type: 1,
        severity: 1,
        latitude: 37.75,
        longitude: -122.40,
        shortDesc: 'Road construction on Market St',
      },
    ],
  },
};

describe('collectIncidents', () => {
  let mockAuth: InrixAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = createMockAuth();
    mockedLogJobStart.mockResolvedValue(1);
    mockedRecordCall.mockResolvedValue(10);
    mockedInsertIncidents.mockResolvedValue(2);
    mockedUpdateCallStatus.mockResolvedValue(undefined);
    mockedLogJobEnd.mockResolvedValue(undefined);
  });

  it('fetches from INRIX incidents URL with correct params', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxios.get.mockResolvedValue({ data: VALID_INCIDENT_RESPONSE });

    await collectIncidents(mockAuth);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://incident-api.inrix.com/v1/incidents',
      expect.objectContaining({
        params: expect.objectContaining({
          box: '37.858|-122.541,37.699|-122.341',
          incidentType: 'Incidents,Construction,Events,Flow',
          incidentoutputfields: 'All',
        }),
      })
    );
  });

  it('returns skipped result without HTTP call when budget NOT allowed', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: false, count: 1600 });

    const result = await collectIncidents(mockAuth);

    expect(result).toEqual({ skipped: true, reason: 'budget_exhausted' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('validates response and inserts all incidents', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxios.get.mockResolvedValue({ data: VALID_INCIDENT_RESPONSE });

    const result = await collectIncidents(mockAuth);

    expect(result).toEqual({ incidentCount: 2 });
    expect(mockedInsertIncidents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'inc-001', severity: 3 }),
        expect.objectContaining({ id: 'inc-002', type: 1 }),
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
    mockedAxios.get.mockImplementation(async () => {
      callOrder.push('axios.get');
      return { data: VALID_INCIDENT_RESPONSE };
    });

    await collectIncidents(mockAuth);

    expect(callOrder.indexOf('recordCall')).toBeLessThan(callOrder.indexOf('axios.get'));
  });

  it('invalidates auth token on 401 response', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });

    const axiosError = new (await import('axios')).AxiosError('Unauthorized');
    axiosError.response = { status: 401, data: {}, headers: {}, statusText: 'Unauthorized', config: {} as any };

    const { withRetry: mockedWithRetry } = await import('../../services/retry.js');
    vi.mocked(mockedWithRetry).mockImplementationOnce(async (fn) => {
      return fn();
    });

    mockedAxios.get.mockRejectedValue(axiosError);

    await expect(collectIncidents(mockAuth)).rejects.toThrow();
    expect(mockAuth.invalidate).toHaveBeenCalled();
  });

  it('logs job start and end on success', async () => {
    mockedCheckBudget.mockResolvedValue({ allowed: true, count: 100 });
    mockedAxios.get.mockResolvedValue({ data: VALID_INCIDENT_RESPONSE });

    await collectIncidents(mockAuth);

    expect(mockedLogJobStart).toHaveBeenCalledWith('inrix_incidents');
    expect(mockedLogJobEnd).toHaveBeenCalledWith(1, 'success', 2);
  });
});
