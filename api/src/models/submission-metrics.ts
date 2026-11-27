import { z } from 'zod';

/** A calculated metric returned for one summary snapshot. */
export const SubmissionMetricRecord = z.object({
  run_id: z.string().uuid(),
  calculated_at: z.string(),
  key: z.string(),
  value: z.unknown().nullable()
});
export type SubmissionMetricRecord = z.infer<typeof SubmissionMetricRecord>;
