import { OpenAPIV3 } from 'openapi-types';

/**
 * Body schema for `POST /api/download/:downloadId/schedule`.
 *
 * Only the cron expression is supplied. `next_run_date` is intentionally absent — the service computes
 * it from the cron expression and the server-fixed timezone before the write, so a caller never
 * supplies (or can falsify) the next occurrence or the zone it's interpreted in.
 */
export const CreateDownloadScheduleRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['cron_expression'],
  properties: {
    cron_expression: {
      type: 'string',
      description: '5-field cron expression for the recurrence, e.g. "0 2 * * *" (daily at 02:00).'
    }
  }
};

/**
 * Response schema for a single download schedule. Mirrors `DownloadScheduleRecord` field-for-field —
 * `record_end_date` is internal soft-delete state and is never returned. `next_run_date` and
 * `last_run_date` are bare ISO strings (not `format: 'date-time'`) to match the model's `z.string()`.
 */
export const DownloadScheduleResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['download_schedule_id', 'download_id', 'cron_expression', 'timezone', 'next_run_date', 'last_run_date'],
  properties: {
    download_schedule_id: { type: 'integer' },
    download_id: { type: 'string', format: 'uuid' },
    cron_expression: { type: 'string' },
    timezone: { type: 'string' },
    next_run_date: { type: 'string', nullable: true },
    last_run_date: { type: 'string', nullable: true }
  }
};
