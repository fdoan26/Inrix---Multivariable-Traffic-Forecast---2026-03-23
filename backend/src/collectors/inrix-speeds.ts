import axios, { AxiosError } from 'axios';
import type { InrixAuthService } from '../services/inrix-auth.js';
import { checkBudget, recordCall, updateCallStatus } from '../services/budget-tracker.js';
import { withRetry } from '../services/retry.js';
import { SpeedResponseSchema } from './schemas/inrix.js';
import { insertSpeedReadings } from '../db/queries/speed-readings.js';
import { logJobStart, logJobEnd } from '../db/queries/budget.js';

const INRIX_SPEED_URL = 'https://segment-api.inrix.com/v1/segments/speed';
const SF_BOX = '37.858|-122.541,37.699|-122.341';

export async function collectSpeeds(
  auth: InrixAuthService
): Promise<{ segmentCount: number } | { skipped: true; reason: string }> {
  const jobId = await logJobStart('inrix_speeds');

  const budget = await checkBudget();
  if (!budget.allowed) {
    await logJobEnd(jobId, 'skipped', 0, `Budget exhausted: ${budget.count} calls this week`);
    return { skipped: true, reason: 'budget_exhausted' };
  }

  const callId = await recordCall('inrix_speeds', INRIX_SPEED_URL);
  const startTime = Date.now();

  try {
    const response = await withRetry(
      async () => {
        const token = await auth.getToken();
        try {
          return await axios.get(INRIX_SPEED_URL, {
            params: {
              box: SF_BOX,
              SpeedOutputFields: 'All',
              units: 0,
              Duration: 120,
            },
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            timeout: 30000,
          });
        } catch (err) {
          if (err instanceof AxiosError && err.response?.status === 401) {
            auth.invalidate();
          }
          throw err;
        }
      },
      { maxAttempts: 3 }
    );

    const parsed = SpeedResponseSchema.parse(response.data);
    const segments = parsed.result.segmentSpeed.flatMap((ss) => ss.segments);

    await insertSpeedReadings(segments, new Date());
    await updateCallStatus(callId, 'success', 200, Date.now() - startTime);
    await logJobEnd(jobId, 'success', segments.length);

    return { segmentCount: segments.length };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const statusCode = error instanceof AxiosError ? error.response?.status : undefined;
    await updateCallStatus(callId, 'error', statusCode, Date.now() - startTime, err.message);
    await logJobEnd(jobId, 'error', 0, err.message);
    throw err;
  }
}
