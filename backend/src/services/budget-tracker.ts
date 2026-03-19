import { query } from '../db/connection.js';
import { startOfISOWeek } from 'date-fns';

export const WEEKLY_LIMIT = parseInt(process.env.INRIX_BUDGET_WEEKLY_LIMIT || '1600', 10);

export async function checkBudget(): Promise<{ allowed: boolean; count: number }> {
  const weekStart = startOfISOWeek(new Date()).toISOString();
  const result = await query(
    `SELECT COUNT(*)::int as count FROM api_call_log WHERE service LIKE 'inrix%' AND called_at >= $1`,
    [weekStart]
  );
  const count: number = result.rows[0].count;
  return { allowed: count < WEEKLY_LIMIT, count };
}

export async function recordCall(service: string, endpoint: string): Promise<number> {
  const result = await query(
    `INSERT INTO api_call_log (service, endpoint, status) VALUES ($1, $2, $3) RETURNING id`,
    [service, endpoint, 'pending']
  );
  return result.rows[0].id;
}

export async function updateCallStatus(
  id: number,
  status: 'success' | 'error',
  statusCode?: number,
  responseTimeMs?: number,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE api_call_log SET status = $1, status_code = $2, response_time_ms = $3, error_message = $4 WHERE id = $5`,
    [status, statusCode, responseTimeMs, errorMessage, id]
  );
}
