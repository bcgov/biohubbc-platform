import { z } from 'zod';

export const SubmissionFeaturePropertyTimestamp = z
  .object({
    submission_feature_property_timestamp_id: z.number().int(),
    submission_feature_id: z.number().int(),
    feature_type_property_id: z.number().int(),
    date_value: z.string().nullable(),
    time_value: z.string().nullable()
  })
  .refine((payload) => payload.date_value !== null || payload.time_value !== null, {
    message: 'At least one of date_value or time_value must be provided'
  });

export type SubmissionFeaturePropertyTimestamp = z.infer<typeof SubmissionFeaturePropertyTimestamp>;

export interface CreateSubmissionFeaturePropertyTimestamp {
  submission_feature_id: number;
  feature_type_property_id: number;
  date_value: string | null;
  time_value: string | null;
}
