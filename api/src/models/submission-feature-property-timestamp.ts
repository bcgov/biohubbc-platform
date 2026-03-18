import { z } from 'zod';

export const SubmissionFeaturePropertyTimestampSchema = z.object({
  submission_feature_property_timestamp_id: z.number().int(),
  submission_feature_id: z.number().int(),
  feature_type_property_id: z.number().int(),
  value: z.string()
});

export type SubmissionFeaturePropertyTimestamp = z.infer<typeof SubmissionFeaturePropertyTimestampSchema>;

export interface CreateSubmissionFeaturePropertyTimestamp {
  submission_feature_id: number;
  feature_type_property_id: number;
  value: string;
}
