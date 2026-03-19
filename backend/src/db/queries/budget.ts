import { query } from '../connection.js';

export async function logJobStart(jobName: string): Promise<number> {
  const result = await query(
    `INSERT INTO job_log (job_name, status) VALUES ($1, 'running') RETURNING id`,
    [jobName]
  );
  return result.rows[0].id;
}

export async function logJobEnd(
  id: number,
  status: 'success' | 'error' | 'skipped',
  recordsProcessed: number,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE job_log SET finished_at = NOW(), status = $1, records_processed = $2, error_message = $3 WHERE id = $4`,
    [status, recordsProcessed, errorMessage ?? null, id]
  );
}
