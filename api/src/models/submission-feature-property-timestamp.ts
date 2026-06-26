import { z } from 'zod';

/**
 * Zod schema for `submission_feature_property_timestamp` rows.
 *
 * The table stores partial-component datetime values: a row may have a date, a time, or both. The
 * DB CHECK constraint guarantees at least one of `date_value` / `time_value` is non-null. Both
 * fields are nullable in the model so partial-component rows pass through without coercion;
 * callers that need a complete `Date` must handle null components.
 *
 * Postgres returns `DATE` as `'YYYY-MM-DD'` and `TIME WITHOUT TIME ZONE` as `'HH:MM:SS'` strings
 * (no special pg parser is installed for these types in `db.ts`).
 */
export const SubmissionFeaturePropertyTimestampSchema = z.object({
  submission_feature_property_timestamp_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  date_value: z.string().nullable(),
  time_value: z.string().nullable()
});

export type SubmissionFeaturePropertyTimestamp = z.infer<typeof SubmissionFeaturePropertyTimestampSchema>;

export interface CreateSubmissionFeaturePropertyTimestamp {
  submission_feature_id: number;
  feature_type_property_id: number;
  date_value: string | null;
  time_value: string | null;
}
